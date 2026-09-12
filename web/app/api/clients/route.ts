import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured, query, transaction } from '@/db/mysql';
import { assertWritable, ForbiddenError, getAccount, TrialExpiredError } from '@/lib/account';

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
  const body = await request.json() as { code?: string; name?: string; email?: string };
  const code = body.code?.trim().toLowerCase(); const name = body.name?.trim(); const email = body.email?.trim().toLowerCase() || null;
  if (!code || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(code)) return Response.json({ error: 'Müşteri kodu küçük harf, rakam ve tire içermelidir.' }, { status: 400 });
  if (!name) return Response.json({ error: 'Müşteri adı zorunludur.' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
  if (email) {
    const existing = await query<{ code: string }>(`SELECT code FROM clients WHERE organization_id=? AND LOWER(notification_email)=? AND code<>? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [account.organizationId, email, code]);
    if (existing[0]) return Response.json({ error: 'Bu e-posta başka bir müşteri hesabında kullanılıyor.' }, { status: 409 });
  }
  await execute(`INSERT INTO clients(organization_id,code,name,notification_email) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),notification_email=VALUES(notification_email),active=TRUE,deleted_at=NULL`, [account.organizationId, code, name, email]);
  await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,retention_until) VALUES(?,?,'client.upserted','client',?,'success',DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, [account.organizationId, account.userId, code]);
  return Response.json({ status: 'ok', code }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });
  try { assertWritable(account); }
  catch (error) {
    if (error instanceof TrialExpiredError) return Response.json({ error: 'Deneme süresi sona erdi. Verileriniz salt okunur durumda.' }, { status: 402 });
    if (error instanceof ForbiddenError) return Response.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
    throw error;
  }
  const body = await request.json() as { id?: number };
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Geçerli bir müşteri seçin.' }, { status: 400 });
  const client = (await query<{ id: number; name: string }>(`SELECT id,name FROM clients WHERE id=? AND organization_id=? AND active=TRUE AND deleted_at IS NULL LIMIT 1`, [id, account.organizationId]))[0];
  if (!client) return Response.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
  await transaction([
    { sql: `UPDATE competitor_sources s JOIN products p ON p.id=s.product_id SET s.active=FALSE,s.deleted_at=CURRENT_TIMESTAMP(3) WHERE s.organization_id=? AND p.client_id=? AND s.active=TRUE AND s.deleted_at IS NULL`, params: [account.organizationId, id] },
    { sql: `UPDATE products SET active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND client_id=? AND active=TRUE AND deleted_at IS NULL`, params: [account.organizationId, id] },
    { sql: `UPDATE clients SET active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND id=?`, params: [account.organizationId, id] },
    { sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'client.deleted','client',?,'success',JSON_OBJECT('name',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, params: [account.organizationId, account.userId, String(id), client.name] },
  ]);
  return Response.json({ status: 'ok' });
}
