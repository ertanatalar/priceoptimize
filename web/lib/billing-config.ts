type BillingEnvironment = Record<string, string | undefined>;

/** Return configuration field names only; never expose secret values. */
export function billingConfigurationIssues(env: BillingEnvironment): string[] {
  const issues: string[] = [];
  const environment = env.PADDLE_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) issues.push('PADDLE_ENVIRONMENT');
  const prefix = environment === 'production' ? 'live_' : 'test_';
  if (!env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.startsWith(prefix)) {
    issues.push('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN');
  }
  for (const key of ['PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET']) {
    if (!env[key]?.trim()) issues.push(key);
  }
  if (!env.PADDLE_PRICE_ID_STARTER?.startsWith('pri_')) issues.push('PADDLE_PRICE_ID_STARTER');
  return issues;
}
