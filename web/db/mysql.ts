type SqlValue = string | number | boolean | null | Date;

export function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HTTP_URL && process.env.MYSQL_HTTP_TOKEN);
}

function configuration() {
  const url = process.env.MYSQL_HTTP_URL?.replace(/\/$/, '');
  const token = process.env.MYSQL_HTTP_TOKEN;
  if (!url || !token) throw new Error('MySQL bağlantısı henüz yapılandırılmadı.');
  return { url, token };
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const { url, token } = configuration();
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || 'MySQL işlemi başarısız.');
  return payload;
}

export async function query<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []) {
  const result = await request<{ rows: T[] }>('/v1/query', { sql, params });
  return result.rows;
}

export async function execute(sql: string, params: SqlValue[] = []) {
  return request<{ rows: unknown }>('/v1/query', { sql, params });
}

export async function transaction(statements: Array<{ sql: string; params?: SqlValue[] }>) {
  return request<{ status: 'ok' }>('/v1/transaction', { statements });
}
