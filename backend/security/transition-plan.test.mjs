import test from 'node:test';
import assert from 'node:assert/strict';
import { identityTransitionPlan, runtimeGrantPlan } from './transition-plan.mjs';
const first = { id: '11111111-1111-4111-8111-111111111111', status: 'active', identity_provider: 'chatgpt', identity_subject_hash: 'a'.repeat(64) };
const second = { ...first, id: '22222222-2222-4222-8222-222222222222', identity_subject_hash: 'b'.repeat(64) };
const mapping = { userId: first.id, oldProvider: 'chatgpt', oldSubjectHash: first.identity_subject_hash, newProvider: 'auth0', newSubjectHash: 'c'.repeat(64), verificationReference: 'operator-reviewed-ticket-123' };
test('transition preserves user UUID and has conditional forward and rollback', () => {
  const [plan] = identityTransitionPlan([first], [mapping]);
  assert.equal(plan.forward.params[2], first.id);
  assert.equal(plan.rollback.params[2], first.id);
  assert.match(plan.forward.sql, /identity_subject_hash=\? AND status='active'/);
  assert.equal(plan.forward.params[4], first.identity_subject_hash);
  assert.equal(plan.rollback.params[4], mapping.newSubjectHash);
});
test('stale, unverified, blocked and email-only mappings fail closed', () => {
  for (const invalid of [{ ...mapping, oldSubjectHash: 'b'.repeat(64) }, { ...mapping, verificationReference: '' }, { userId: first.id, email: 'same@example.com' }, { ...mapping, newProvider: 'chatgpt' }]) assert.throws(() => identityTransitionPlan([first], [invalid]));
  assert.throws(() => identityTransitionPlan([{ ...first, status: 'blocked' }], [mapping]));
  assert.throws(() => identityTransitionPlan([first], []));
});
test('duplicate and already claimed destinations cannot merge accounts', () => {
  assert.throws(() => identityTransitionPlan([first], [mapping, mapping]));
  assert.throws(() => identityTransitionPlan([first, second], [mapping, { ...mapping, userId: second.id, oldSubjectHash: second.identity_subject_hash }]));
  assert.throws(() => identityTransitionPlan([first, { ...second, identity_provider: 'auth0', identity_subject_hash: mapping.newSubjectHash }], [mapping]));
});
test('runtime plan preserves collector expiry but denies schema/global administration', () => {
  const plan = runtimeGrantPlan({ database: 'defaultdb', username: 'priceopt_runtime' });
  assert.equal(plan.statements.filter((s) => s.startsWith('GRANT DELETE')).length, 3);
  assert.ok(plan.statements.some((s) => s.includes('`billing_checkout_sessions`') && s.startsWith('GRANT UPDATE')));
  assert.ok(plan.statements.some((s) => s.includes('`billing_webhook_events`') && s.startsWith('GRANT SELECT, INSERT')));
  assert.match(plan.statements.find((s) => s.startsWith('GRANT DELETE')), /`defaultdb`\.`observations`/);
  assert.ok(plan.statements.some((s) => s.startsWith('GRANT DELETE') && s.includes('`erasure_records`')));
  assert.ok(plan.statements.some((s) => s.startsWith('GRANT UPDATE') && s.includes('`users`')));
  for (const sql of plan.statements) assert.doesNotMatch(sql, /\*|CREATE|ALTER|DROP|FILE|GRANT OPTION/);
  assert.throws(() => runtimeGrantPlan({ database: 'defaultdb', username: 'avnadmin' }));
  assert.throws(() => runtimeGrantPlan({ database: 'db; DROP DATABASE x', username: 'runtime' }));
});
