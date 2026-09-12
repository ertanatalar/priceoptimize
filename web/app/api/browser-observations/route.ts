import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, query, transaction } from '@/db/mysql';
import { assertWritable, ForbiddenError, getAccount, TrialExpiredError } from '@/lib/account';

type SourceRow = {
  id: number;
  url: string;
  merchant: string;
  productName: string;
  clientCode: string;
  clientName: string;
  currency: string;
  maxPriceDropPct: number;
  referencePrice: number | null;
};

function comparableProductLocation(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Yalnızca HTTPS ürün adresleri kabul edilir.');
  return {
    host: url.hostname.toLowerCase().replace(/^www\./, ''),
    path: url.pathname.replace(/\/+$/, '').toLowerCase(),
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  if (!mysqlConfigured()) return Response.json({ error: 'MySQL bağlantısı henüz yapılandırılmadı.' }, { status: 503 });
  const account = await getAccount(user);
  if (!account) return Response.json({ error: 'Hesap bulunamadı.' }, { status: 409 });
  try { assertWritable(account); }
  catch (error) {
    if (error instanceof TrialExpiredError) return Response.json({ error: 'Deneme süresi sona erdi.' }, { status: 402 });
    if (error instanceof ForbiddenError) return Response.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
    throw error;
  }

  const body = await request.json() as { sourceId?: number; pageUrl?: string; price?: number; currency?: string; inStock?: boolean | null };
  const requestedSourceId = Number(body.sourceId);
  const sourceId = Number.isInteger(requestedSourceId) && requestedSourceId > 0 ? requestedSourceId : null;
  const price = Number(body.price);
  const currency = String(body.currency ?? '').trim().toUpperCase();
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) {
    return Response.json({ error: 'Pozitif bir fiyat girilmelidir.' }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: 'Para birimi üç harfli ISO kodu olmalıdır.' }, { status: 400 });

  const selectSource = `
    SELECT s.id,s.url,s.merchant,p.name AS productName,c.code AS clientCode,c.name AS clientName,p.currency,
           p.max_price_drop_pct AS maxPriceDropPct,
           accepted.price AS referencePrice
    FROM competitor_sources s
    JOIN products p ON p.id=s.product_id AND p.organization_id=s.organization_id
    JOIN clients c ON c.id=p.client_id AND c.organization_id=p.organization_id
    LEFT JOIN observations accepted ON accepted.id=(
      SELECT o.id FROM observations o
      WHERE o.source_id=s.id AND o.price IS NOT NULL AND o.error_code IS NULL
        AND o.is_price_anomaly=FALSE
      ORDER BY o.checked_at DESC,o.id DESC LIMIT 1
    )
    WHERE s.organization_id=? AND s.active=TRUE AND s.deleted_at IS NULL
      AND p.active=TRUE AND p.deleted_at IS NULL`;

  let candidates: SourceRow[];
  if (sourceId) {
    candidates = await query<SourceRow>(`${selectSource} AND s.id=? LIMIT 1`, [account.organizationId, sourceId]);
  } else {
    let observed: ReturnType<typeof comparableProductLocation>;
    try { observed = comparableProductLocation(String(body.pageUrl ?? '')); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Ürün adresi doğrulanamadı.' }, { status: 400 }); }
    const locationKey = `${observed.host}${observed.path}`;
    candidates = await query<SourceRow>(`${selectSource}
      AND LOWER(TRIM(TRAILING '/' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(s.url,'?',1),'#',1),'://',-1))) IN (?,?)
      LIMIT 50`, [account.organizationId, locationKey, `www.${locationKey}`]);
    if (candidates.length > 1) {
      return Response.json({
        error: 'Bu URL birden fazla rakip kaydında kullanılıyor. Fiyatın ait olduğu müşteri ve ürünü seçin.',
        candidates: candidates.map(({ id, clientCode, clientName, productName, merchant }) => ({ id, clientCode, clientName, productName, merchant })),
      }, { status: 409 });
    }
  }
  const source = candidates[0];
  if (!source) return Response.json({ error: 'Rakip URL bulunamadı.' }, { status: 404 });
  if (currency !== source.currency) return Response.json({ error: `Bu ürün için ${source.currency} bekleniyor.` }, { status: 400 });

  try {
    const expected = comparableProductLocation(source.url);
    const observed = comparableProductLocation(String(body.pageUrl ?? ''));
    if (expected.host !== observed.host || expected.path !== observed.path) {
      return Response.json({ error: 'Açılan sayfa kayıtlı rakip ürün URL’siyle eşleşmiyor.' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Ürün adresi doğrulanamadı.' }, { status: 400 });
  }

  const referencePrice = source.referencePrice == null ? null : Number(source.referencePrice);
  const dropPct = referencePrice && referencePrice > 0 ? ((referencePrice - price) / referencePrice) * 100 : null;
  const isAnomaly = dropPct != null && dropPct >= Number(source.maxPriceDropPct);
  const anomalyReason = isAnomaly
    ? `Tarayıcıdan doğrulanan fiyat son geçerli ${referencePrice} değerinden %${dropPct.toFixed(2)} düştü; %${Number(source.maxPriceDropPct).toFixed(2)} eşiği nedeniyle en iyi fiyat hesabından çıkarıldı.`
    : null;

  await transaction([
    {
      sql: `INSERT INTO observations(organization_id,source_id,price,currency,in_stock,error_code,is_price_anomaly,anomaly_reason,reference_price,drop_pct,retention_until) VALUES(?,?,?,?,?,NULL,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 730 DAY))`,
      params: [account.organizationId, source.id, price, currency, body.inStock == null ? null : Boolean(body.inStock), isAnomaly, anomalyReason, referencePrice, dropPct],
    },
    {
      sql: `INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'observation.browser_confirmed','competitor_source',?,'success',JSON_OBJECT('merchant',?,'price',?,'currency',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,
      params: [account.organizationId, account.userId, String(source.id), source.merchant, price, currency],
    },
  ]);

  return Response.json({
    status: 'ok',
    merchant: source.merchant,
    productName: source.productName,
    isPriceAnomaly: isAnomaly,
    anomalyReason,
  }, { status: 201 });
}
