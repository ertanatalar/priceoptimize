import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, query } from '@/db/mysql';
import { getAccount } from '@/lib/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured())
    return Response.json(
      { error: 'MySQL bağlantısı yapılandırılmadı.' },
      { status: 503 },
    );
  const account = await getAccount(user);
  if (!account)
    return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });

  const organizationId = account.organizationId;
  const clientId = account.scope === 'client' ? account.clientId : null;
  const [
    organization,
    subscription,
    billingAccount,
    clients,
    products,
    sources,
    observations,
    privacyRequests,
    retentionPolicies,
    auditEvents,
  ] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id,name,code,default_locale AS defaultLocale,data_region AS dataRegion,status,created_at AS createdAt FROM organizations WHERE id=?`,
      [organizationId],
    ),
    query<Record<string, unknown>>(
      `SELECT state,trial_started_at AS trialStartedAt,trial_ends_at AS trialEndsAt,plan_code AS planCode,created_at AS createdAt,updated_at AS updatedAt FROM subscriptions WHERE organization_id=?`,
      [organizationId],
    ),
    account.scope === 'organization'
      ? query<Record<string, unknown>>(
          `SELECT provider,provider_customer_id AS providerCustomerId,provider_subscription_id AS providerSubscriptionId,provider_price_id AS providerPriceId,current_period_ends_at AS currentPeriodEndsAt,scheduled_change AS scheduledChange,created_at AS createdAt,updated_at AS updatedAt FROM billing_accounts WHERE organization_id=?`,
          [organizationId],
        )
      : Promise.resolve([]),
    query<Record<string, unknown>>(
      `SELECT id,code,name,notification_email AS notificationEmail,active,created_at AS createdAt,deleted_at AS deletedAt FROM clients WHERE organization_id=? AND (? IS NULL OR id=?)`,
      [organizationId, clientId, clientId],
    ),
    query<Record<string, unknown>>(
      `SELECT id,client_id AS clientId,sku,name,currency,max_price_drop_pct AS maxPriceDropPct,active,created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt FROM products WHERE organization_id=? AND (? IS NULL OR client_id=?)`,
      [organizationId, clientId, clientId],
    ),
    query<Record<string, unknown>>(
      `SELECT s.id,s.product_id AS productId,s.merchant,s.url,s.active,s.created_at AS createdAt,s.deleted_at AS deletedAt FROM competitor_sources s JOIN products p ON p.id=s.product_id WHERE s.organization_id=? AND (? IS NULL OR p.client_id=?)`,
      [organizationId, clientId, clientId],
    ),
    query<Record<string, unknown>>(
      `SELECT o.id,o.source_id AS sourceId,o.price,o.currency,o.in_stock AS inStock,o.checked_at AS checkedAt,o.error_code AS errorCode,o.is_price_anomaly AS isPriceAnomaly,o.anomaly_reason AS anomalyReason,o.reference_price AS referencePrice,o.drop_pct AS dropPct,o.retention_until AS retentionUntil FROM observations o JOIN competitor_sources s ON s.id=o.source_id JOIN products p ON p.id=s.product_id WHERE o.organization_id=? AND (? IS NULL OR p.client_id=?) ORDER BY o.checked_at DESC`,
      [organizationId, clientId, clientId],
    ),
    query<Record<string, unknown>>(
      `SELECT id,request_type AS requestType,jurisdiction,status,due_at AS dueAt,completed_at AS completedAt,resolution_note AS resolutionNote,created_at AS createdAt FROM privacy_requests WHERE organization_id=? AND (? IS NULL OR LOWER(requester_email)=?) ORDER BY created_at DESC`,
      [organizationId, clientId, clientId ? user.email.toLowerCase() : null],
    ),
    account.scope === 'organization'
      ? query<Record<string, unknown>>(
          `SELECT data_category AS dataCategory,retention_days AS retentionDays,legal_basis AS legalBasis,action,updated_at AS updatedAt FROM retention_policies WHERE organization_id=?`,
          [organizationId],
        )
      : Promise.resolve([]),
    account.scope === 'organization'
      ? query<Record<string, unknown>>(
          `SELECT event_type AS eventType,object_type AS objectType,object_id AS objectId,outcome,occurred_at AS occurredAt,retention_until AS retentionUntil FROM audit_events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 5000`,
          [organizationId],
        )
      : Promise.resolve([]),
  ]);

  return new Response(
    JSON.stringify(
      {
        format: 'priceoptimize-data-export-v1',
        generatedAt: new Date().toISOString(),
        account: {
          email: user.email,
          role: account.role,
          scope: account.scope,
        },
        organization: organization[0] ?? null,
        subscription: subscription[0] ?? null,
        billingAccount: billingAccount[0] ?? null,
        clients,
        products,
        competitorSources: sources,
        observations,
        privacyRequests,
        retentionPolicies,
        auditEvents,
        note: 'Parolalar, ödeme kartları, ham IP adresleri ve özel nitelikli kişisel veriler bu uygulama veritabanında tutulmaz.',
      },
      null,
      2,
    ),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="priceoptimize-verilerim-${new Date().toISOString().slice(0, 10)}.json"`,
        'cache-control': 'private, no-store',
      },
    },
  );
}
