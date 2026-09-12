import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured, query, transaction } from '@/db/mysql';
import { assertWritable, ForbiddenError, getAccount, TrialExpiredError } from '@/lib/account';

async function writableAccount() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: 'Oturum gerekli' }, { status: 401 }) };
  if (!mysqlConfigured()) return { response: Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 }) };
  const account = await getAccount(user);
  if (!account) return { response: Response.json({ error: 'Önce hesabınızı oluşturun.' }, { status: 409 }) };
  try { assertWritable(account); }
  catch (error) {
    if (error instanceof TrialExpiredError) return { response: Response.json({ error: 'Deneme süresi sona erdi. Verileriniz salt okunur durumda.' }, { status: 402 }) };
    if (error instanceof ForbiddenError) return { response: Response.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 }) };
    throw error;
  }
  return { account };
}

export async function POST(request: Request) {
  const context = await writableAccount();
  if ('response' in context) return context.response;
  const { account } = context;
  const body = await request.json() as { clientCode?: string; sku?: string; name?: string; currency?: string; maxPriceDropPct?: number };
  const clientCode = body.clientCode?.trim().toLowerCase();
  const sku = body.sku?.trim();
  const name = body.name?.trim();
  const currency = (body.currency?.trim() || 'TRY').toUpperCase();
  const threshold = Number(body.maxPriceDropPct ?? 25);
  if (!clientCode || !sku || !name) return Response.json({ error: 'Müşteri, grup kodu ve ürün adı zorunludur.' }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: 'Para birimi üç harfli ISO kodu olmalıdır.' }, { status: 400 });
  if (!(threshold >= 0 && threshold < 100)) return Response.json({ error: 'Düşüş eşiği 0 ile 100 arasında olmalıdır.' }, { status: 400 });
  const client = (await query<{ id: number }>(`SELECT id FROM clients WHERE organization_id=? AND code=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [account.organizationId, clientCode]))[0];
  if (!client) return Response.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
  await execute(`INSERT INTO products(organization_id,client_id,sku,name,currency,max_price_drop_pct) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),currency=VALUES(currency),max_price_drop_pct=VALUES(max_price_drop_pct),active=TRUE,deleted_at=NULL`, [account.organizationId, client.id, sku, name, currency, threshold]);
  await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'product.upserted','product',?,'success',JSON_OBJECT('clientCode',?,'name',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, [account.organizationId, account.userId, sku, clientCode, name]);
  return Response.json({ status: 'ok' }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context = await writableAccount();
  if ('response' in context) return context.response;
  const { account } = context;
  const body = await request.json() as { id?: number };
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Geçerli bir ürün grubu seçin.' }, { status: 400 });
  const product = (await query<{ id: number; name: string }>(`SELECT id,name FROM products WHERE id=? AND organization_id=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [id, account.organizationId]))[0];
  if (!product) return Response.json({ error: 'Ürün grubu bulunamadı.' }, { status: 404 });
  await transaction([
    { sql: `UPDATE competitor_sources SET active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND product_id=? AND active=TRUE AND deleted_at IS NULL`, params: [account.organizationId, id] },
    { sql: `UPDATE products SET active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND id=?`, params: [account.organizationId, id] },
    { sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'product.deleted','product',?,'success',JSON_OBJECT('name',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, params: [account.organizationId, account.userId, String(id), product.name] },
  ]);
  return Response.json({ status: 'ok' });
}
