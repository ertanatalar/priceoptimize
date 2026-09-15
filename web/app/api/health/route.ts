import { mysqlConfigured, query } from '@/db/mysql';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!mysqlConfigured()) {
    return Response.json(
      { status: 'unhealthy', database: 'not_configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    await query<{ ok: number }>('SELECT 1 AS ok');
    return Response.json(
      { status: 'ok', database: 'mysql' },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unhealthy', database: 'mysql' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
