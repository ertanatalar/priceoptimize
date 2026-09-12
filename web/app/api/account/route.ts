import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, transaction } from '@/db/mysql';
import { getAccount } from '@/lib/account';
import { sha256, uuid } from '@/lib/security';

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });
  if (account.scope !== 'client' || !account.clientId) return Response.json({ error: 'Bu işlem müşteri portalı hesabı içindir.' }, { status: 403 });

  const clientId = account.clientId;
  const subjectReferenceHash = await sha256(`${account.organizationId}|${clientId}|${user.email.toLowerCase()}`);
  await transaction([
    {
      sql: `UPDATE observations o JOIN competitor_sources s ON s.id=o.source_id JOIN products p ON p.id=s.product_id SET o.price=NULL,o.currency=NULL,o.in_stock=NULL,o.error_code='ERASED',o.is_price_anomaly=FALSE,o.anomaly_reason=NULL,o.reference_price=NULL,o.drop_pct=NULL,o.retention_until=CURRENT_TIMESTAMP(3) WHERE o.organization_id=? AND p.client_id=?`,
      params: [account.organizationId, clientId],
    },
    {
      sql: `UPDATE competitor_sources s JOIN products p ON p.id=s.product_id SET s.merchant='Silinmiş kaynak',s.url=CONCAT('https://deleted.invalid/source/',s.id),s.url_hash=SHA2(CONCAT('erased-source-',s.id),256),s.active=FALSE,s.deleted_at=CURRENT_TIMESTAMP(3) WHERE s.organization_id=? AND p.client_id=?`,
      params: [account.organizationId, clientId],
    },
    {
      sql: `UPDATE products SET sku=CONCAT('deleted-',id),name='Silinmiş ürün',active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND client_id=?`,
      params: [account.organizationId, clientId],
    },
    {
      sql: `INSERT INTO erasure_records(id,organization_id,subject_reference_hash,method,scope,legal_hold,retain_until) VALUES(?,?,?,'anonymize','Müşteri portalı hesabı ve bağlı fiyat kayıtları',FALSE,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,
      params: [uuid(), account.organizationId, subjectReferenceHash],
    },
    {
      sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,NULL,'client_portal.erased','client',?,'success',JSON_OBJECT('method','anonymize'),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,
      params: [account.organizationId, String(clientId)],
    },
    {
      sql: `UPDATE clients SET code=CONCAT('deleted-',id),name='Silinmiş müşteri',notification_email=NULL,notification_email_verified_at=NULL,active=FALSE,deleted_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND id=?`,
      params: [account.organizationId, clientId],
    },
  ]);
  return Response.json({ status: 'ok' });
}
