import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured, query, transaction } from '@/db/mysql';
import { assertWritable, ForbiddenError, getAccount, TrialExpiredError } from '@/lib/account';
import { sha256 } from '@/lib/security';

type Watch = { group?: string; name?: string; currency?: string; merchant?: string; url?: string; maxPriceDropPct?: number };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ error: 'Önce hesabınızı oluşturun.' }, { status: 409 });
  try { assertWritable(account); }
  catch (error) {
    if (error instanceof TrialExpiredError) return Response.json({ error: 'Deneme süresi sona erdi. Verileriniz salt okunur durumda.' }, { status: 402 });
    if (error instanceof ForbiddenError) return Response.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
    throw error;
  }
  const body = await request.json() as { clientCode?: string; rows?: Watch[] };
  const clientCode = body.clientCode?.trim().toLowerCase(); const rows = body.rows ?? [];
  if (!clientCode || rows.length === 0 || rows.length > 1000) return Response.json({ error: 'Müşteri ve 1–1000 URL satırı gereklidir.' }, { status: 400 });
  const client = (await query<{ id: number }>(`SELECT id FROM clients WHERE organization_id=? AND code=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [account.organizationId, clientCode]))[0];
  if (!client) return Response.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
  for (const row of rows) {
    const group = row.group?.trim(); const name = row.name?.trim(); const merchant = row.merchant?.trim();
    const currency = (row.currency?.trim() || 'TRY').toUpperCase(); const threshold = Number(row.maxPriceDropPct ?? 25);
    let url: URL;
    try { url = new URL(row.url?.trim() || ''); } catch { return Response.json({ error: `Geçersiz URL: ${row.url ?? ''}` }, { status: 400 }); }
    if (!group || !name || !merchant || !['http:', 'https:'].includes(url.protocol)) return Response.json({ error: 'Grup, ürün adı, mağaza ve HTTP(S) URL zorunludur.' }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: 'Para birimi üç harfli ISO kodu olmalıdır.' }, { status: 400 });
    if (!(threshold >= 0 && threshold < 100)) return Response.json({ error: 'Düşüş eşiği 0 ile 100 arasında olmalıdır.' }, { status: 400 });
    const normalizedUrl = url.toString(); const urlHash = await sha256(normalizedUrl);
    await transaction([
      { sql: `INSERT INTO products(organization_id,client_id,sku,name,currency,max_price_drop_pct) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),currency=VALUES(currency),max_price_drop_pct=VALUES(max_price_drop_pct),active=TRUE,deleted_at=NULL`, params: [account.organizationId, client.id, group, name, currency, threshold] },
      { sql: `INSERT INTO competitor_sources(organization_id,product_id,merchant,url,url_hash) SELECT ?,id,?,?,? FROM products WHERE organization_id=? AND client_id=? AND sku=? ON DUPLICATE KEY UPDATE merchant=VALUES(merchant),active=TRUE,deleted_at=NULL`, params: [account.organizationId, merchant, normalizedUrl, urlHash, account.organizationId, client.id, group] },
    ]);
  }
  await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'watch.imported','competitor_source',NULL,'success',JSON_OBJECT('count',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, [account.organizationId, account.userId, rows.length]);
  return Response.json({ status: 'ok', imported: rows.length }, { status: 201 });
}
