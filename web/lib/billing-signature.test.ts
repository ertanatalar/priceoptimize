import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
// Node's type-stripping test runner requires the explicit TypeScript extension.
// oxlint-disable-next-line typescript(TS5097)
import { verifyPaddleSignature } from './billing-signature.ts';

void test('accepts a valid Paddle signature', async () => {
  process.env.PADDLE_WEBHOOK_SECRET = 'test-secret';
  const body = JSON.stringify({ event_id: 'evt_1' });
  const timestamp = 1_700_000_000;
  const signature = createHmac('sha256', 'test-secret')
    .update(`${timestamp}:${body}`)
    .digest('hex');
  assert.equal(
    await verifyPaddleSignature(
      body,
      `ts=${timestamp};h1=${signature}`,
      timestamp,
    ),
    true,
  );
});

void test('rejects tampering and replayed signatures', async () => {
  process.env.PADDLE_WEBHOOK_SECRET = 'test-secret';
  const timestamp = 1_700_000_000;
  const body = '{}';
  const signature = createHmac('sha256', 'test-secret')
    .update(`${timestamp}:${body}`)
    .digest('hex');
  assert.equal(
    await verifyPaddleSignature(
      'tampered',
      `ts=${timestamp};h1=${signature}`,
      timestamp,
    ),
    false,
  );
  assert.equal(
    await verifyPaddleSignature(
      body,
      `ts=${timestamp};h1=${signature}`,
      timestamp + 31,
    ),
    false,
  );
});
