import assert from 'node:assert/strict';
import test from 'node:test';
import { billingConfigurationIssues } from './billing-config.ts';

const sandbox = {
  PADDLE_ENVIRONMENT: 'sandbox', NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'test_example',
  PADDLE_API_KEY: 'private-key', PADDLE_WEBHOOK_SECRET: 'private-secret',
  PADDLE_PRICE_ID_STARTER: 'pri_example',
};
test('sandbox and production must use matching client tokens', () => {
  assert.deepEqual(billingConfigurationIssues(sandbox), []);
  assert.deepEqual(billingConfigurationIssues({ ...sandbox, PADDLE_ENVIRONMENT: 'production' }), ['NEXT_PUBLIC_PADDLE_CLIENT_TOKEN']);
  assert.deepEqual(billingConfigurationIssues({ ...sandbox, PADDLE_ENVIRONMENT: 'production', NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'live_example' }), []);
  assert.deepEqual(billingConfigurationIssues({ ...sandbox, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'live_example' }), ['NEXT_PUBLIC_PADDLE_CLIENT_TOKEN']);
});
test('missing secrets and unknown environments cannot enable checkout', () => {
  const issues = billingConfigurationIssues({ ...sandbox, PADDLE_API_KEY: ' ', PADDLE_WEBHOOK_SECRET: '', PADDLE_ENVIRONMENT: 'prod', PADDLE_PRICE_ID_STARTER: 'pro_wrong' });
  assert.deepEqual(issues, ['PADDLE_ENVIRONMENT', 'PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_PRICE_ID_STARTER']);
  assert.equal(JSON.stringify(issues).includes('private-secret'), false);
});
