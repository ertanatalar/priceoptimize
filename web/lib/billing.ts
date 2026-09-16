import { query } from '@/db/mysql';
export { verifyPaddleSignature } from '@/lib/billing-signature';

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export function paddleConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
    process.env.PADDLE_API_KEY &&
    process.env.PADDLE_WEBHOOK_SECRET &&
    process.env.PADDLE_PRICE_ID_STARTER,
  );
}

export function paddleEnvironment(): 'sandbox' | 'production' {
  return process.env.PADDLE_ENVIRONMENT === 'production'
    ? 'production'
    : 'sandbox';
}

export function paddleApiOrigin() {
  return paddleEnvironment() === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';
}

export function starterPriceId() {
  const value = process.env.PADDLE_PRICE_ID_STARTER;
  if (!value) throw new Error('PADDLE_PRICE_ID_STARTER yapılandırılmadı.');
  return value;
}

export async function paddleApi<T>(path: string, init: RequestInit = {}) {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error('PADDLE_API_KEY yapılandırılmadı.');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${apiKey}`);
  headers.set('content-type', 'application/json');
  const response = await fetch(`${paddleApiOrigin()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const payload = (await response.json()) as T & {
    error?: { detail?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(
      payload.error?.detail ??
        payload.error?.code ??
        'Paddle isteği başarısız.',
    );
  }
  return payload;
}

export function mapPaddleStatus(status: string): BillingStatus {
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'trialing') return 'trialing';
  if (status === 'canceled' || status === 'paused') return 'cancelled';
  return 'expired';
}

export async function findOrganizationForBillingEvent(data: {
  custom_data?: Record<string, unknown> | null;
  id?: string;
  subscription_id?: string | null;
}) {
  const rawCheckoutRef = data.custom_data?.checkout_ref;
  const checkoutRef = typeof rawCheckoutRef === 'string' ? rawCheckoutRef : '';
  if (checkoutRef) {
    const sessions = await query<{ organizationId: string }>(
      `SELECT organization_id AS organizationId FROM billing_checkout_sessions WHERE id=? AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP(3) LIMIT 1`,
      [checkoutRef],
    );
    if (sessions[0]) return { ...sessions[0], checkoutRef };
  }
  const externalSubscriptionId = data.subscription_id ?? data.id;
  if (!externalSubscriptionId) return null;
  const accounts = await query<{ organizationId: string }>(
    `SELECT organization_id AS organizationId FROM billing_accounts WHERE provider='paddle' AND provider_subscription_id=? LIMIT 1`,
    [externalSubscriptionId],
  );
  return accounts[0] ? { ...accounts[0], checkoutRef: null } : null;
}
