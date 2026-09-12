import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured } from '@/db/mysql';
import { getAccount } from '@/lib/account';
import { uuid } from '@/lib/security';

const allowed = new Set(['access','rectification','erasure','restriction','portability','objection']);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });
  const body = await request.json() as { requestType?: string; jurisdiction?: string };
  if (!body.requestType || !allowed.has(body.requestType)) return Response.json({ error: 'Geçersiz talep türü.' }, { status: 400 });
  const jurisdiction = ['GDPR','KVKK','both'].includes(body.jurisdiction ?? '') ? body.jurisdiction! : 'both';
  const id = uuid();
  await execute(`INSERT INTO privacy_requests(id,organization_id,requester_user_id,requester_email,request_type,jurisdiction,due_at) VALUES(?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 30 DAY))`, [id, account.organizationId, account.userId, user.email.toLowerCase(), body.requestType, jurisdiction]);
  await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,retention_until) VALUES(?,?,'privacy.requested','privacy_request',?,'success',DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, [account.organizationId, account.userId, id]);
  return Response.json({ status: 'received', requestId: id, dueDays: 30 }, { status: 201 });
}
