import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { monitorAll } from './collector.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const PORT = Number(process.env.PORT || 3001);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni zorunludur.`);
  return value;
}

function databaseConnectionOptions() {
  const databaseUrl = new URL(required('DATABASE_URL'));
  return {
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.replace(/^\//, ''),
  };
}

function tokenMatches(header, expected) {
  if (!header?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RequestError(413, 'İstek gövdesi çok büyük.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Geçersiz JSON.');
  }
}

function validateStatement(statement) {
  if (!statement || typeof statement.sql !== 'string' || !statement.sql.trim()) {
    throw new RequestError(400, 'SQL ifadesi zorunludur.');
  }
  if (statement.sql.includes(';')) throw new RequestError(400, 'Her istekte tek SQL ifadesi kullanılmalıdır.');
  if (!/^(SELECT|WITH|INSERT|UPDATE)\b/i.test(statement.sql.trim())) {
    throw new RequestError(400, 'Bu SQL işlemi uygulama API’sinde izinli değildir.');
  }
  if (statement.params !== undefined && !Array.isArray(statement.params)) {
    throw new RequestError(400, 'SQL parametreleri dizi olmalıdır.');
  }
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createPool() {
  const ca = process.env.MYSQL_CA_CERT?.replace(/\\n/g, '\n');
  if (!ca) throw new Error('MYSQL_CA_CERT ortam değişkeni zorunludur.');
  return mysql.createPool({
    ...databaseConnectionOptions(),
    ssl: { ca, rejectUnauthorized: true },
    connectionLimit: 8,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true,
    timezone: 'Z',
  });
}

async function migrate() {
  const ca = required('MYSQL_CA_CERT').replace(/\\n/g, '\n');
  const connection = await mysql.createConnection({
    ...databaseConnectionOptions(),
    ssl: { ca, rejectUnauthorized: true },
    multipleStatements: true,
    timezone: 'Z',
  });
  const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/db/mysql-schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  try {
    await connection.query(schema);
  } finally {
    await connection.end();
  }
}

export function createApp(pool, apiToken, monitorToken = apiToken) {
  return createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health') {
        await pool.query('SELECT 1 AS ok');
        return json(response, 200, { status: 'ok', database: 'mysql' });
      }

      if (request.method !== 'POST' || !['/v1/query', '/v1/transaction', '/v1/monitor'].includes(request.url)) {
        return json(response, 404, { error: 'Bulunamadı.' });
      }
      const expectedToken = request.url === '/v1/monitor' ? monitorToken : apiToken;
      if (!tokenMatches(request.headers.authorization, expectedToken)) {
        return json(response, 401, { error: 'Yetkisiz istek.' });
      }

      const body = await readJson(request);
      if (request.url === '/v1/monitor') {
        const result = await monitorAll(pool);
        return json(response, 200, result);
      }
      if (request.url === '/v1/query') {
        validateStatement(body);
        const [rows] = await pool.execute(body.sql, body.params ?? []);
        return json(response, 200, { rows });
      }

      if (!Array.isArray(body.statements) || body.statements.length < 1 || body.statements.length > 50) {
        throw new RequestError(400, 'İşlem 1 ile 50 SQL ifadesi içermelidir.');
      }
      body.statements.forEach(validateStatement);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const statement of body.statements) {
          await connection.execute(statement.sql, statement.params ?? []);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return json(response, 200, { status: 'ok' });
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      if (status === 500) console.error('Database API request failed', error);
      return json(response, status, { error: status === 500 ? 'Veritabanı işlemi başarısız.' : error.message });
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  await migrate();
  const pool = createPool();
  const server = createApp(pool, required('DATABASE_API_TOKEN'), required('MONITOR_API_TOKEN'));
  server.listen(PORT, '0.0.0.0', () => console.log(`Database API listening on ${PORT}`));
}
