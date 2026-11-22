const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, env = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => { if (name in mocks) return mocks[name]; if (name === '@/lib/i18n-server') return { localeJson: (request,body,init) => Response.json(body,init) }; if (name.endsWith('shared/i18n.mjs')) return require(path.resolve(path.dirname(path.join(root,file)),name)); throw Error(`Unexpected import ${name}`); }, process: { env }, Response, Request, Headers, URL, Date, JSON, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, atob, btoa, console });
  return module.exports;
}
function authHarness(env = {}) {
  const values = new Map();
  const headers = new Headers({ 'oai-authenticated-user-id': 'forged-subject', 'oai-authenticated-user-email': 'owner@example.com' });
  const auth = load('app/chatgpt-auth.ts', { 'next/headers': { cookies: async () => ({ get: (name) => values.has(name) ? { value: values.get(name) } : undefined }), headers: async () => headers }, 'next/navigation': { redirect: () => { throw Error('redirect'); } } }, env);
  return { auth, values, headers };
}
const user = { userId: 'subject', identityProvider: 'auth0', email: 'person@example.com', emailVerified: true };
const account = { userId: 'user-1', organizationId: 'org-1', scope: 'organization', role: 'owner', subscriptionState: 'active', trialEndsAt: '2099-01-01' };
const hash = async (v) => createHash('sha256').update(v).digest('hex');

test('checkout CSP permits official Paddle endpoints and isolates live from sandbox', async () => {
  for (const environment of ['sandbox', 'production']) {
    const config = load('next.config.ts', {}, { PADDLE_ENVIRONMENT: environment }).default;
    const headers = await config.headers();
    const policy = headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
    assert.match(policy, /script-src 'self' https:\/\/cdn\.paddle\.com;/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.doesNotMatch(policy, /unsafe-eval|https:\/\/\*/);
    if (environment === 'production') {
      assert.doesNotMatch(policy, /sandbox-/);
      assert.match(policy, /frame-src https:\/\/buy\.paddle\.com https:\/\/create-checkout\.paddle\.com;/);
    } else assert.match(policy, /https:\/\/sandbox-buy\.paddle\.com/);
  }
});

test('Render and partial Auth0 configuration never accept client platform identity headers', async () => {
  for (const env of [{ RENDER: 'true' }, { AUTH_PROVIDER: 'auth0' }, { AUTH0_DOMAIN: 'example.auth0.com' }, { AUTH0_CLIENT_ID: 'client' }]) {
    assert.equal(await authHarness(env).auth.getChatGPTUser(), null);
  }
});
test('Sites deployment retains trusted platform identity integration', async () => {
  const h = authHarness();
  assert.equal((await h.auth.getChatGPTUser()).userId, 'forged-subject');
});
test('encrypted Auth0 sessions require verified email, valid expiry and authentic ciphertext', async () => {
  const h = authHarness({ AUTH0_DOMAIN: 'example.auth0.com', AUTH0_CLIENT_ID: 'client', AUTH0_CLIENT_SECRET: 'secret', AUTH0_SECRET: 'a-strong-random-test-secret-of-32-or-more-characters' });
  const session = { sub: 'real-subject', email: 'real@example.com', email_verified: true, exp: Math.floor(Date.now()/1000)+3600 };
  const token = await h.auth.encryptAuth0Session(session);
  h.values.set('po_session', token);
  assert.equal((await h.auth.getChatGPTUser()).userId, 'real-subject');
  for (const bad of [token + '.extra', token.slice(0, -10) + 'AAAAAAAAAA', await h.auth.encryptAuth0Session({ ...session, email_verified: false }), await h.auth.encryptAuth0Session({ ...session, exp: 1 })]) {
    h.values.set('po_session', bad);
    assert.equal(await h.auth.getChatGPTUser(), null);
  }
});
test('OAuth return paths cannot redirect to another origin', () => {
  const { auth } = authHarness();
  for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/signin-with-chatgpt', '/callback']) assert.equal(auth.safeRelativeReturnPath(url), '/');
  assert.equal(auth.safeRelativeReturnPath('/capture?source=12'), '/capture?source=12');
});
function accountHarness(results) {
  const calls = [], writes = [];
  const lib = load('lib/account.ts', { '@/db/mysql': { query: async (sql, params) => { calls.push({ sql, params }); return results.shift() || []; }, execute: async (sql, params) => writes.push({ sql, params }) }, '@/lib/security': { sha256: hash } });
  return { lib, calls, writes };
}
test('email alone never grants organization ownership; only one verified portal invitation is accepted', async () => {
  const portal = { ...account, userId: null, scope: 'client', role: 'viewer', clientId: 3, notificationVerified: 1 };
  const h = accountHarness([[], [portal]]);
  assert.equal((await h.lib.getAccount(user)).scope, 'client');
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[1].sql, /FROM clients/);
  assert.doesNotMatch(h.calls[1].sql, /FROM users/);
});
test('unverified portal email and ambiguous multi-tenant invitations fail closed', async () => {
  const unverified = accountHarness([[]]);
  assert.equal(await unverified.lib.getAccount({ ...user, emailVerified: false }), null);
  assert.equal(unverified.calls.length, 1);
  assert.equal(unverified.writes.length, 0);
  const ambiguous = accountHarness([[], [{ ...account, scope: 'client', clientId: 1 }, { ...account, scope: 'client', clientId: 2 }]]);
  assert.equal(await ambiguous.lib.getAccount(user), null);
  assert.equal(ambiguous.writes.length, 0);
});
test('all cross-origin browser mutation signals are rejected', () => {
  const { rejectCrossOriginMutation } = load('lib/request-security.ts');
  for (const headers of [{ origin: 'https://evil.test' }, { 'sec-fetch-site': 'cross-site' }, { origin: 'null' }]) {
    assert.equal(rejectCrossOriginMutation(new Request('https://app.test/api/clients', { method: 'POST', headers })).status, 403);
  }
  assert.equal(rejectCrossOriginMutation(new Request('https://app.test/api/clients', { method: 'POST', headers: { origin: 'https://app.test' } })), null);
});
test('foreign client deletion cannot write; portal viewer cannot modify clients', async () => {
  const policy = load('lib/account.ts', { '@/db/mysql': {}, '@/lib/security': {} });
  let context = account;
  let writes = 0;
  const route = load('app/api/clients/route.ts', {
    '@/lib/request-security': load('lib/request-security.ts'),
    '@/app/chatgpt-auth': { getChatGPTUser: async () => user },
    '@/db/mysql': { mysqlConfigured: () => true, query: async (sql, params) => { assert.equal(params[1], 'org-1'); assert.match(sql, /organization_id=\?/); return []; }, execute: async () => { writes++; }, transaction: async () => { writes++; } },
    '@/lib/account': { ...policy, getAccount: async () => context },
  });
  const request = () => new Request('https://app.test/api/clients', { method: 'DELETE', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: JSON.stringify({ id: 999 }) });
  assert.equal((await route.DELETE(request())).status, 404);
  context = { ...account, role: 'viewer', scope: 'client' };
  assert.equal((await route.DELETE(request())).status, 403);
  assert.equal(writes, 0);
});

test('public origin works behind a proxy without trusting forged host headers', () => {
  const { rejectCrossOriginMutation } = load('lib/request-security.ts', {}, { PUBLIC_BASE_URL: 'https://www.priceoptimize.ai/' });
  const request = (headers) => new Request('http://localhost:3000/api/browser-observations', { method: 'POST', headers });
  assert.equal(rejectCrossOriginMutation(request({ origin: 'https://www.priceoptimize.ai', 'sec-fetch-site': 'same-origin' })), null);
  for (const headers of [
    { origin: 'https://evil.test', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https' },
    { origin: 'http://localhost:3000' },
    { origin: 'https://priceoptimize.ai' },
    { origin: 'null' },
    { origin: 'https://www.priceoptimize.ai', 'sec-fetch-site': 'cross-site' },
  ]) assert.equal(rejectCrossOriginMutation(request(headers)).status, 403);
});
test('invalid configured public origins fail closed', () => {
  for (const PUBLIC_BASE_URL of ['invalid-url', 'file:///tmp/app', 'https://user:password@app.test']) {
    const { rejectCrossOriginMutation } = load('lib/request-security.ts', {}, { PUBLIC_BASE_URL });
    assert.equal(rejectCrossOriginMutation(new Request('https://app.test/api/browser-observations', { method: 'POST', headers: { origin: 'https://app.test' } })).status, 403);
  }
});
