const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness() {
  const writes = [];
  class DatabaseRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const account = { organizationId: 'org-1', userId: 'user-1' };
  let rejected = false;
  const mocks = {
    '@/lib/request-security': { rejectCrossOriginMutation: () => null },
    '@/app/chatgpt-auth': { getChatGPTUser: async () => ({}) },
    '@/db/mysql': { DatabaseRequestError, mysqlConfigured: () => true, query: async () => [{ id: 1 }], transaction: async (statements, options) => { writes.push({ statements, options }); if (rejected) throw new DatabaseRequestError('Paketiniz en fazla 50 aktif rakip link içerir.', 409); } },
    '@/lib/account': { getAccount: async () => account, assertWritable: () => {}, ForbiddenError: class extends Error {}, TrialExpiredError: class extends Error {} },
    '@/lib/security': { sha256: async (url) => `hash:${url}` },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/api/watches/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name], Response, Request, URL, Number });
  const row = { group: 'PHONE', name: 'Telefon', merchant: 'Rakip', url: 'https://example.com/phone' };
  return { writes, row, rejectQuota: () => { rejected = true; }, post: (rows) => module.exports.POST(new Request('https://app.test/api/watches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientCode: 'client', rows }) })) };
}
test('all import rows are validated before any transaction is sent', async () => {
  const h = harness();
  assert.equal((await h.post([h.row, { ...h.row, url: 'invalid' }])).status, 400);
  assert.equal(h.writes.length, 0);
});
test('single and bulk imports use the organization quota in one atomic transaction', async () => {
  const h = harness();
  assert.equal((await h.post([h.row, { ...h.row, url: 'https://example.com/other' }])).status, 201);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].statements.length, 5);
  assert.equal(h.writes[0].options.sourceQuota.organizationId, 'org-1');
});
test('quota failures return an actionable conflict and never report import success', async () => {
  const h = harness(); h.rejectQuota();
  const response = await h.post([h.row]);
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /50/);
});
