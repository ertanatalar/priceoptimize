import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  mysqlConfigured,
  notifyBrowserChanges,
  query,
  transaction,
} from '@/db/mysql';
import {
  assertWritable,
  ForbiddenError,
  getAccount,
  TrialExpiredError,
} from '@/lib/account';

type BatchObservation = {
  sourceId?: number;
  pageUrl?: string;
  price?: number;
  currency?: string;
  inStock?: boolean | null;
};

type SourceRow = {
  id: number;
  url: string;
  merchant: string;
  clientId: number;
  currency: string;
  maxPriceDropPct: number;
  referencePrice: number | null;
};

function comparableProductLocation(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:')
    throw new Error('Yalnızca HTTPS ürün adresleri kabul edilir.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const amazonAsin =
    host === 'amazon.com.tr'
      ? url.pathname.match(/\/dp\/([a-z0-9]{10})(?:\/|$)/i)?.[1]
      : null;
  return {
    host,
    path: amazonAsin
      ? `/dp/${amazonAsin.toLowerCase()}`
      : url.pathname.replace(/\/+$/, '').toLowerCase(),
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured())
    return Response.json(
      { error: 'MySQL bağlantısı henüz yapılandırılmadı.' },
      { status: 503 },
    );
  const account = await getAccount(user);
  if (!account)
    return Response.json({ error: 'Hesap bulunamadı.' }, { status: 409 });
  try {
    assertWritable(account);
  } catch (error) {
    if (error instanceof TrialExpiredError)
      return Response.json(
        { error: 'Deneme süresi sona erdi.' },
        { status: 402 },
      );
    if (error instanceof ForbiddenError)
      return Response.json(
        { error: 'Bu işlem için yetkiniz yok.' },
        { status: 403 },
      );
    throw error;
  }

  const body = (await request.json()) as { observations?: BatchObservation[] };
  const observations = Array.isArray(body.observations)
    ? body.observations.slice(0, 1000)
    : [];
  if (!observations.length)
    return Response.json(
      { error: 'İçe aktarılacak fiyat sonucu bulunamadı.' },
      { status: 400 },
    );
  if ((body.observations?.length ?? 0) > 1000)
    return Response.json(
      { error: 'Bir işlemde en fazla 1000 sonuç yüklenebilir.' },
      { status: 413 },
    );

  const ids = [
    ...new Set(
      observations
        .map((item) => Number(item.sourceId))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (!ids.length)
    return Response.json(
      { error: 'Geçerli rakip URL kimliği bulunamadı.' },
      { status: 400 },
    );
  const placeholders = ids.map(() => '?').join(',');
  const sources = await query<SourceRow>(
    `
    SELECT s.id,s.url,s.merchant,p.client_id AS clientId,p.currency,p.max_price_drop_pct AS maxPriceDropPct,
           accepted.price AS referencePrice
    FROM competitor_sources s
    JOIN products p ON p.id=s.product_id AND p.organization_id=s.organization_id
    LEFT JOIN observations accepted ON accepted.id=(
      SELECT o.id FROM observations o
      WHERE o.source_id=s.id AND o.price IS NOT NULL AND o.error_code IS NULL AND o.is_price_anomaly=FALSE
      ORDER BY o.checked_at DESC,o.id DESC LIMIT 1
    )
    WHERE s.organization_id=? AND s.active=TRUE AND s.deleted_at IS NULL
      AND p.active=TRUE AND p.deleted_at IS NULL AND s.id IN (${placeholders})
  `,
    [account.organizationId, ...ids],
  );
  const sourceById = new Map(
    sources.map((source) => [Number(source.id), source]),
  );
  const failures: Array<{ sourceId: number; error: string }> = [];
  const statements: Array<{
    sql: string;
    params: Array<string | number | boolean | null>;
  }> = [];
  let imported = 0;
  let anomalies = 0;
  const changesByClient = new Map<number, string[]>();

  for (const item of observations) {
    const sourceId = Number(item.sourceId);
    const source = sourceById.get(sourceId);
    if (!source) {
      failures.push({
        sourceId,
        error: 'Rakip URL bulunamadı veya bu hesaba ait değil.',
      });
      continue;
    }
    const price = Number(item.price);
    const currency = String(item.currency ?? '')
      .trim()
      .toUpperCase();
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) {
      failures.push({ sourceId, error: 'Pozitif fiyat bulunamadı.' });
      continue;
    }
    if (currency !== source.currency) {
      failures.push({ sourceId, error: `${source.currency} bekleniyor.` });
      continue;
    }
    try {
      const expected = comparableProductLocation(source.url);
      const observed = comparableProductLocation(String(item.pageUrl ?? ''));
      if (expected.host !== observed.host || expected.path !== observed.path)
        throw new Error('Açılan sayfa kayıtlı URL ile eşleşmiyor.');
    } catch (error) {
      failures.push({
        sourceId,
        error:
          error instanceof Error ? error.message : 'Ürün adresi doğrulanamadı.',
      });
      continue;
    }
    const referencePrice =
      source.referencePrice == null ? null : Number(source.referencePrice);
    const dropPct =
      referencePrice && referencePrice > 0
        ? ((referencePrice - price) / referencePrice) * 100
        : null;
    const isAnomaly =
      dropPct != null && dropPct >= Number(source.maxPriceDropPct);
    const anomalyReason = isAnomaly
      ? `Toplu tarayıcı kontrolündeki fiyat son geçerli ${referencePrice} değerinden %${dropPct.toFixed(2)} düştü; %${Number(source.maxPriceDropPct).toFixed(2)} eşiği nedeniyle en iyi fiyat hesabından çıkarıldı.`
      : null;
    if (isAnomaly) anomalies += 1;
    if (referencePrice != null && Number(referencePrice) !== price) {
      const changes = changesByClient.get(Number(source.clientId)) ?? [];
      changes.push(
        isAnomaly
          ? `${source.merchant}: ${referencePrice} → ${price} ${currency}; aşırı düşüş filtresine takıldı`
          : `${source.merchant}: ${referencePrice} → ${price} ${currency}`,
      );
      changesByClient.set(Number(source.clientId), changes);
    }
    statements.push({
      sql: `INSERT INTO observations(organization_id,source_id,price,currency,in_stock,error_code,is_price_anomaly,anomaly_reason,reference_price,drop_pct,retention_until) VALUES(?,?,?,?,?,NULL,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 730 DAY))`,
      params: [
        account.organizationId,
        sourceId,
        price,
        currency,
        item.inStock == null ? null : Boolean(item.inStock),
        isAnomaly,
        anomalyReason,
        referencePrice,
        dropPct,
      ],
    });
    statements.push({
      sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'observation.browser_batch','competitor_source',?,'success',JSON_OBJECT('merchant',?,'price',?,'currency',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,
      params: [
        account.organizationId,
        account.userId,
        String(sourceId),
        source.merchant,
        price,
        currency,
      ],
    });
    imported += 1;
  }

  for (let index = 0; index < statements.length; index += 100)
    await transaction(statements.slice(index, index + 100));

  let emailsSent = 0;
  const emailFailures: Array<{ clientId: number; error: string }> = [];
  for (const [clientId, changes] of changesByClient) {
    try {
      const notification = await notifyBrowserChanges({
        organizationId: account.organizationId,
        clientId,
        changes,
      });
      if (notification.status === 'sent') emailsSent += 1;
    } catch (error) {
      emailFailures.push({
        clientId,
        error: error instanceof Error ? error.message : 'E-posta gönderilemedi.',
      });
    }
  }
  return Response.json(
    { status: 'ok', imported, anomalies, failures, emailsSent, emailFailures },
    { status: 201 },
  );
}
