import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, query } from '@/db/mysql';
import { getAccount } from '@/lib/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.', databaseEngine: 'MySQL' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ needsOnboarding: true, databaseEngine: 'MySQL' });
  const organizationId = account.organizationId;
  const clientId = account.scope === 'client' ? account.clientId : null;
  const [clients, products, sources] = await Promise.all([
    query<Record<string, unknown>>(`
      SELECT c.id,c.code,c.name,c.notification_email AS notificationEmail,c.active,c.created_at AS createdAt,
             COUNT(DISTINCT p.id) AS productCount,COUNT(DISTINCT s.id) AS sourceCount
      FROM clients c
      LEFT JOIN products p ON p.client_id=c.id AND p.active=TRUE AND p.deleted_at IS NULL
      LEFT JOIN competitor_sources s ON s.product_id=p.id AND s.active=TRUE AND s.deleted_at IS NULL
      WHERE c.organization_id=? AND (? IS NULL OR c.id=?) AND c.active=TRUE AND c.deleted_at IS NULL
      GROUP BY c.id,c.code,c.name,c.notification_email,c.active,c.created_at ORDER BY c.name
    `, [organizationId, clientId, clientId]),
    query<Record<string, unknown>>(`
      SELECT p.id,p.sku,p.name,p.currency,p.max_price_drop_pct AS maxPriceDropPct,
             c.id AS clientId,c.code AS clientCode,c.name AS clientName,COUNT(s.id) AS sourceCount
      FROM products p JOIN clients c ON c.id=p.client_id AND c.organization_id=p.organization_id
      LEFT JOIN competitor_sources s ON s.product_id=p.id AND s.active=TRUE AND s.deleted_at IS NULL
      WHERE p.organization_id=? AND (? IS NULL OR c.id=?) AND p.active=TRUE AND p.deleted_at IS NULL AND c.active=TRUE AND c.deleted_at IS NULL
      GROUP BY p.id,p.sku,p.name,p.currency,p.max_price_drop_pct,c.id,c.code,c.name ORDER BY c.name,p.name
    `, [organizationId, clientId, clientId]),
    query<Record<string, unknown>>(`
      WITH latest AS (
        SELECT o.*,ROW_NUMBER() OVER(PARTITION BY o.source_id ORDER BY o.checked_at DESC,o.id DESC) rn
        FROM observations o WHERE o.organization_id=?
      )
      SELECT s.id,s.merchant,s.url,s.product_id AS productId,p.sku,p.name AS productName,p.currency,
             c.code AS clientCode,c.name AS clientName,l.price,l.currency AS observedCurrency,
             l.in_stock AS inStock,l.checked_at AS checkedAt,l.error_code AS error,
             l.is_price_anomaly AS isPriceAnomaly,l.anomaly_reason AS anomalyReason
      FROM competitor_sources s
      JOIN products p ON p.id=s.product_id AND p.organization_id=s.organization_id
      JOIN clients c ON c.id=p.client_id AND c.organization_id=p.organization_id
      LEFT JOIN latest l ON l.source_id=s.id AND l.rn=1
      WHERE s.organization_id=? AND (? IS NULL OR c.id=?) AND s.active=TRUE AND s.deleted_at IS NULL
        AND p.active=TRUE AND p.deleted_at IS NULL AND c.active=TRUE AND c.deleted_at IS NULL
      ORDER BY c.name,p.name,s.merchant
    `, [organizationId, organizationId, clientId, clientId]),
  ]);
  const validSources = sources.filter((row) => row.price != null && row.error == null && row.inStock !== 0 && row.isPriceAnomaly !== 1);
  const bestByProduct = new Map<number, { price: number; merchant: string }>();
  for (const row of validSources) {
    const productId = Number(row.productId); const price = Number(row.price); const current = bestByProduct.get(productId);
    if (!current || price < current.price) bestByProduct.set(productId, { price, merchant: String(row.merchant) });
  }
  return Response.json({
    clients,
    products: products.map((row) => ({ ...row, best: bestByProduct.get(Number(row.id)) ?? null })),
    sources,
    account: { organizationName: account.organizationName, role: account.role, scope: account.scope, clientId: account.clientId, subscriptionState: account.subscriptionState, trialEndsAt: account.trialEndsAt, trialDaysRemaining: Number(account.trialDaysRemaining), databaseEngine: 'MySQL', dataRegion: 'EU' },
    metrics: { activeClients: clients.length, watchedUrls: sources.length, validPrices: validSources.length, issues: sources.filter((row) => row.error || row.isPriceAnomaly === 1).length },
  });
}
