import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, query, transaction } from '@/db/mysql';
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

export async function PATCH(request: Request) {
  const context = await writableAccount();
  if ('response' in context) return context.response;
  const { account } = context;
  const body = await request.json() as { id?: number; targetProductId?: number };
  const id = Number(body.id); const targetProductId = Number(body.targetProductId);
  if (![id, targetProductId].every((value) => Number.isSafeInteger(value) && value > 0)) return Response.json({ error: 'Kaynak ve hedef ürün grubu zorunludur.' }, { status: 400 });
  const source = (await query<{ id: number; productId: number; clientId: number; urlHash: string; merchant: string }>(`
    SELECT s.id,s.product_id AS productId,p.client_id AS clientId,s.url_hash AS urlHash,s.merchant
    FROM competitor_sources s JOIN products p ON p.id=s.product_id AND p.organization_id=s.organization_id
    WHERE s.id=? AND s.organization_id=? AND s.active=TRUE AND s.deleted_at IS NULL AND p.active=TRUE AND p.deleted_at IS NULL LIMIT 1
  `, [id, account.organizationId]))[0];
  if (!source) return Response.json({ error: 'Rakip URL bulunamadı.' }, { status: 404 });
  const target = (await query<{ id: number; clientId: number; name: string }>(`SELECT id,client_id AS clientId,name FROM products WHERE id=? AND organization_id=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [targetProductId, account.organizationId]))[0];
  if (!target) return Response.json({ error: 'Hedef ürün grubu bulunamadı.' }, { status: 404 });
  if (Number(source.clientId) !== Number(target.clientId)) return Response.json({ error: 'URL yalnızca aynı müşterinin başka bir ürün grubuna taşınabilir.' }, { status: 409 });
  if (Number(source.productId) === targetProductId) return Response.json({ status: 'ok' });
  const duplicate = (await query<{ id: number }>(`SELECT id FROM competitor_sources WHERE organization_id=? AND product_id=? AND url_hash=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [account.organizationId, targetProductId, source.urlHash]))[0];
  if (duplicate) return Response.json({ error: 'Bu URL hedef ürün grubunda zaten bulunuyor.' }, { status: 409 });
  await transaction([
    { sql: `UPDATE competitor_sources SET product_id=? WHERE id=? AND organization_id=?`, params: [targetProductId, id, account.organizationId] },
    { sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'source.moved','competitor_source',?,'success',JSON_OBJECT('fromProductId',?,'toProductId',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, params: [account.organizationId, account.userId, String(id), source.productId, targetProductId] },
  ]);
  return Response.json({ status: 'ok' });
}

export async function DELETE(request: Request) {
  const context = await writableAccount();
  if ('response' in context) return context.response;
  const { account } = context;
  const body = await request.json() as { id?: number };
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Geçerli bir rakip URL seçin.' }, { status: 400 });
  const source = (await query<{ id: number; merchant: string }>(`SELECT id,merchant FROM competitor_sources WHERE id=? AND organization_id=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [id, account.organizationId]))[0];
  if (!source) return Response.json({ error: 'Rakip URL bulunamadı.' }, { status: 404 });
  await transaction([
    { sql: `UPDATE competitor_sources SET active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE id=? AND organization_id=?`, params: [id, account.organizationId] },
    { sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'source.deleted','competitor_source',?,'success',JSON_OBJECT('merchant',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, params: [account.organizationId, account.userId, String(id), source.merchant] },
  ]);
  return Response.json({ status: 'ok' });
}
