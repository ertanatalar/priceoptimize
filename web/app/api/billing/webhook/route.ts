import { query, transaction } from '@/db/mysql';
import {
  findOrganizationForBillingEvent,
  mapPaddleStatus,
  verifyPaddleSignature,
} from '@/lib/billing';
import { sha256 } from '@/lib/security';

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string | null;
    next_billed_at?: string | null;
    current_billing_period?: { ends_at?: string | null } | null;
    scheduled_change?: { action?: string } | null;
    custom_data?: Record<string, unknown> | null;
    items?: Array<{ price?: { id?: string } }>;
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (
    !(await verifyPaddleSignature(
      rawBody,
      request.headers.get('paddle-signature'),
    ))
  )
    return Response.json(
      { error: 'Geçersiz webhook imzası.' },
      { status: 401 },
    );

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return Response.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  if (!event.event_id || !event.event_type || !event.occurred_at || !event.data)
    return Response.json({ error: 'Eksik Paddle olayı.' }, { status: 400 });
  const eventId = event.event_id;
  const eventType = event.event_type;

  const duplicate = await query<{ eventId: string }>(
    `SELECT event_id AS eventId FROM billing_webhook_events WHERE provider='paddle' AND event_id=? LIMIT 1`,
    [eventId],
  );
  if (duplicate.length) return Response.json({ status: 'duplicate' });

  const eventTime = new Date(event.occurred_at);
  if (!Number.isFinite(eventTime.getTime()))
    return Response.json({ error: 'Geçersiz olay zamanı.' }, { status: 400 });
  const payloadHash = await sha256(rawBody);
  const eventInsert = {
    sql: `INSERT INTO billing_webhook_events(provider,event_id,event_type,payload_sha256,occurred_at) VALUES('paddle',?,?,?,?)`,
    params: [eventId, eventType, payloadHash, eventTime],
  };
  const relevant =
    eventType.startsWith('subscription.') ||
    eventType === 'transaction.completed' ||
    eventType === 'transaction.payment_failed';
  if (!relevant) {
    await transaction([eventInsert]);
    return Response.json({ status: 'ignored' });
  }

  const match = await findOrganizationForBillingEvent(event.data);
  if (!match) {
    await transaction([eventInsert]);
    return Response.json({ status: 'unmatched' });
  }
  const current = await query<{ lastEventAt: string | null }>(
    `SELECT last_event_occurred_at AS lastEventAt FROM billing_accounts WHERE organization_id=? LIMIT 1`,
    [match.organizationId],
  );
  if (
    current[0]?.lastEventAt &&
    new Date(current[0].lastEventAt).getTime() > eventTime.getTime()
  ) {
    await transaction([eventInsert]);
    return Response.json({ status: 'stale' });
  }

  const data = event.data;
  const subscriptionId =
    data.subscription_id ??
    (eventType.startsWith('subscription.') ? (data.id ?? null) : null);
  let state = mapPaddleStatus(data.status ?? '');
  if (eventType === 'transaction.completed') state = 'active';
  if (eventType === 'transaction.payment_failed') state = 'past_due';
  const periodEnd =
    data.current_billing_period?.ends_at ?? data.next_billed_at ?? null;
  const priceId = data.items?.[0]?.price?.id ?? null;
  if (data.customer_id || subscriptionId) {
    const conflicting = await query<{ organizationId: string }>(
      `SELECT organization_id AS organizationId FROM billing_accounts WHERE provider='paddle' AND ((? IS NOT NULL AND provider_customer_id=?) OR (? IS NOT NULL AND provider_subscription_id=?)) LIMIT 1`,
      [
        data.customer_id ?? null,
        data.customer_id ?? null,
        subscriptionId,
        subscriptionId,
      ],
    );
    if (
      conflicting[0] &&
      conflicting[0].organizationId !== match.organizationId
    ) {
      await transaction([eventInsert]);
      return Response.json({ status: 'identity_conflict' });
    }
  }
  const statements = [
    eventInsert,
    {
      sql: `INSERT INTO billing_accounts(organization_id,provider,provider_customer_id,provider_subscription_id,provider_price_id,current_period_ends_at,scheduled_change,last_event_occurred_at) VALUES(?,'paddle',?,?,?,?,?,?) ON DUPLICATE KEY UPDATE provider_customer_id=COALESCE(VALUES(provider_customer_id),provider_customer_id),provider_subscription_id=COALESCE(VALUES(provider_subscription_id),provider_subscription_id),provider_price_id=COALESCE(VALUES(provider_price_id),provider_price_id),current_period_ends_at=COALESCE(VALUES(current_period_ends_at),current_period_ends_at),scheduled_change=VALUES(scheduled_change),last_event_occurred_at=VALUES(last_event_occurred_at)`,
      params: [
        match.organizationId,
        data.customer_id ?? null,
        subscriptionId,
        priceId,
        periodEnd ? new Date(periodEnd) : null,
        data.scheduled_change?.action ?? null,
        eventTime,
      ],
    },
    {
      sql: `UPDATE subscriptions SET state=?,plan_code='starter' WHERE organization_id=?`,
      params: [state, match.organizationId],
    },
    {
      sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,NULL,?,'subscription',?,'success',JSON_OBJECT('provider','paddle','state',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,
      params: [
        match.organizationId,
        `billing.${eventType}`,
        subscriptionId ?? eventId,
        state,
      ],
    },
  ];
  if (match.checkoutRef)
    statements.push({
      sql: `UPDATE billing_checkout_sessions SET consumed_at=COALESCE(consumed_at,CURRENT_TIMESTAMP(3)) WHERE id=? AND organization_id=?`,
      params: [match.checkoutRef, match.organizationId],
    });
  await transaction(statements);
  return Response.json({ status: 'processed' });
}
