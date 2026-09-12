import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAccount } from '@/lib/account';
import { execute, mysqlConfigured, transaction } from '@/db/mysql';
import { PRIVACY_VERSION, TERMS_VERSION, sha256, uuid } from '@/lib/security';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  if (await getAccount(user)) return Response.json({ status: 'ok', alreadyExists: true });
  const body = await request.json() as { organizationName?: string; organizationCode?: string; locale?: string; acceptedTerms?: boolean; acceptedPrivacy?: boolean; marketingConsent?: boolean };
  const name = body.organizationName?.trim();
  const code = body.organizationCode?.trim().toLowerCase();
  const locale = body.locale === 'en' ? 'en-GB' : 'tr-TR';
  if (!name || !code || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(code)) return Response.json({ error: 'Geçerli kuruluş adı ve kodu zorunludur.' }, { status: 400 });
  if (!body.acceptedTerms || !body.acceptedPrivacy) return Response.json({ error: 'Hizmet koşulları ve aydınlatma metni kabul edilmelidir.' }, { status: 400 });

  const organizationId = uuid();
  const userId = uuid();
  const subjectHash = await sha256(user.userId);
  const acceptedAt = new Date().toISOString();
  const evidenceBase = `${subjectHash}|${acceptedAt}`;
  const statements = [
    { sql: `INSERT INTO organizations(id,name,code,default_locale,data_region) VALUES(?,?,?,?,?)`, params: [organizationId, name, code, locale, 'eu'] },
    { sql: `INSERT INTO users(id,identity_provider,identity_subject_hash,email,email_verified_at,locale,last_login_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, params: [userId, user.identityProvider, subjectHash, user.email.toLowerCase(), user.emailVerified ? acceptedAt : null, locale] },
    { sql: `INSERT INTO organization_memberships(organization_id,user_id,role) VALUES(?,?,'owner')`, params: [organizationId, userId] },
    { sql: `INSERT INTO subscriptions(organization_id,state,trial_started_at,trial_ends_at,plan_code) VALUES(?,'trialing',CURRENT_TIMESTAMP(3),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 30 DAY),'trial')`, params: [organizationId] },
    { sql: `INSERT INTO legal_acceptances(id,organization_id,user_id,document_type,document_version,lawful_basis,accepted,evidence_hash) VALUES(?,?,?,'privacy_notice',?,'contract',TRUE,?)`, params: [uuid(), organizationId, userId, PRIVACY_VERSION, await sha256(`${evidenceBase}|privacy|${PRIVACY_VERSION}`)] },
    { sql: `INSERT INTO legal_acceptances(id,organization_id,user_id,document_type,document_version,lawful_basis,accepted,evidence_hash) VALUES(?,?,?,'terms',?,'contract',TRUE,?)`, params: [uuid(), organizationId, userId, TERMS_VERSION, await sha256(`${evidenceBase}|terms|${TERMS_VERSION}`)] },
    { sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'account.created','organization',?,'success',JSON_OBJECT('privacyVersion',?,'termsVersion',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`, params: [organizationId, userId, organizationId, PRIVACY_VERSION, TERMS_VERSION] },
    { sql: `INSERT INTO retention_policies(organization_id,data_category,retention_days,legal_basis,action) VALUES
      (?, 'price_observations', 730, 'service analytics', 'delete'),
      (?, 'audit_events', 1095, 'security and accountability', 'delete'),
      (?, 'erasure_records', 1095, 'KVKK deletion log requirement', 'delete'),
      (?, 'inactive_account', 90, 'service termination', 'review')`, params: [organizationId, organizationId, organizationId, organizationId] },
  ];
  if (body.marketingConsent) statements.splice(6, 0, { sql: `INSERT INTO legal_acceptances(id,organization_id,user_id,document_type,document_version,lawful_basis,accepted,evidence_hash) VALUES(?,?,?,'marketing',?,'consent',TRUE,?)`, params: [uuid(), organizationId, userId, PRIVACY_VERSION, await sha256(`${evidenceBase}|marketing|${PRIVACY_VERSION}`)] });
  try { await transaction(statements); }
  catch (error) { return Response.json({ error: error instanceof Error && /duplicate/i.test(error.message) ? 'Bu kuruluş kodu kullanımda.' : 'Hesap oluşturulamadı.' }, { status: 409 }); }
  await execute(`UPDATE users SET last_login_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [userId]);
  return Response.json({ status: 'ok', trialDays: 30 }, { status: 201 });
}
