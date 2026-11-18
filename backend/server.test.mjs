import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
const { createApp } = await import('./server.mjs');

async function withServer(pool, run) {
  const server = createApp(pool, 'test-token', 'monitor-token');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('health endpoint checks MySQL', async () => {
  const pool = { query: async () => [[{ ok: 1 }]] };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'mysql' });
  });
});

test('query endpoint requires bearer token', async () => {
  const pool = { execute: async () => [[{ ok: 1 }]] };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/query`, { method: 'POST', body: JSON.stringify({ sql: 'SELECT 1' }) });
    assert.equal(response.status, 401);
  });
});

test('query endpoint returns parameterized rows', async () => {
  const pool = { execute: async (sql, params) => [[{ sql, params }]] };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/query`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT ? AS value', params: [7] }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { rows: [{ sql: 'SELECT ? AS value', params: [7] }] });
  });
});

test('transaction rolls back after a failed statement', async () => {
  const events = [];
  const connection = {
    beginTransaction: async () => events.push('begin'),
    execute: async () => { events.push('execute'); throw new Error('boom'); },
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  };
  const pool = { getConnection: async () => connection };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/transaction`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ statements: [{ sql: 'INSERT INTO clients(name) VALUES(?)', params: ['A'] }] }),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(events, ['begin', 'execute', 'rollback', 'release']);
  });
});

test('monitor endpoint requires bearer token', async () => {
  const pool = { execute: async () => [[]] };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/monitor`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 401);
  });
});

test('browser notification endpoint requires bearer token', async () => {
  const pool = { execute: async () => [[]] };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/browser-notify`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 401);
  });
});


test('monitor token cannot access SQL query endpoint', async () => {
  let calls = 0;
  const pool = { execute: async () => { calls++; return [[]]; } };
  await withServer(pool, async (origin) => {
    const response = await fetch(`${origin}/v1/query`, { method: 'POST', headers: { authorization: 'Bearer monitor-token' }, body: JSON.stringify({ sql: 'SELECT 1' }) });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  });
});

test('malformed bodies and destructive SQL never reach the database', async () => {
  let calls = 0;
  const pool = { execute: async () => { calls++; return [[]]; }, getConnection: async () => { calls++; } };
  await withServer(pool, async (origin) => {
    for (const payload of [null, [], 'bad', { sql: 'DROP TABLE users' }, { sql: 'SELECT 1; SELECT 2' }, { sql: 'SELECT ?', params: 'not-array' }]) {
      const response = await fetch(`${origin}/v1/query`, { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(payload) });
      assert.equal(response.status, 400);
    }
    const response = await fetch(`${origin}/v1/transaction`, { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify({ statements: [{ sql: 'INSERT INTO clients(name) VALUES(?)', params: ['A'] }, { sql: 'DELETE FROM users' }] }) });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
});
