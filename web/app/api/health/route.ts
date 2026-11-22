import { localeJson } from '@/lib/i18n-server';
import { mysqlConfigured, query } from '@/db/mysql';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!mysqlConfigured()) {
    return localeJson(request,
      { status: 'unhealthy', database: 'not_configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    await query<{ ok: number }>('SELECT 1 AS ok');
    return localeJson(request,
      { status: 'ok', database: 'mysql' },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return localeJson(request,
      { status: 'unhealthy', database: 'mysql' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
