import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSourceQuota, lockSourceQuota } from './source-quota.mjs';
const org = '87174023-405f-491f-be9a-e4bb680084d7';
test('quota takes a tenant subscription row lock and distinguishes trial from paid access', async () => {
  for (const [state, limit] of [['active', 50], ['trialing', 10]]) {
    const connection = { execute: async (sql, params) => {
      assert.match(sql, /WHERE organization_id=\? FOR UPDATE/);
      assert.deepEqual(params, [org]);
      return [[{ state, trial_valid: 1 }]];
    } };
    assert.equal(await lockSourceQuota(connection, org), limit);
  }
});
test('expired trials and unpaid states cannot import sources', async () => {
  for (const row of [{ state: 'expired' }, { state: 'past_due' }, { state: 'trialing', trial_valid: 0 }]) {
    await assert.rejects(lockSourceQuota({ execute: async () => [[row]] }, org), { status: 402 });
  }
  await assert.rejects(lockSourceQuota({}, 'not-an-org'), { status: 400 });
});
test('the final active source count permits exactly 50 and rejects 51', async () => {
  const connection = (used) => ({ execute: async (sql, params) => {
    assert.match(sql, /active=TRUE AND deleted_at IS NULL/);
    assert.deepEqual(params, [org]);
    return [[{ used }]];
  } });
  await assertSourceQuota(connection('50'), org, 50);
  await assert.rejects(assertSourceQuota(connection('51'), org, 50), { status: 409 });
  await assertSourceQuota(connection(10), org, 10);
  await assert.rejects(assertSourceQuota(connection(11), org, 10), { status: 409 });
});
