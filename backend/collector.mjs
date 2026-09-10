import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const USER_AGENT = 'PriceOptimizeBot/1.0 (+https://priceoptimize.ai; competitor price monitoring)';
const MAX_HTML_BYTES = 5_000_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

export class CollectionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function parseDecimal(value) {
  let text = String(value ?? '').replace(/[^0-9,.-]/g, '').trim();
  if (!text) throw new CollectionError('PRICE_INVALID', 'Fiyat değeri boş.');
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replaceAll('.', '').replace(',', '.')
      : text.replaceAll(',', '');
  } else if (text.includes(',')) {
    const tail = text.split(',').at(-1);
    text = tail.length === 1 || tail.length === 2 ? text.replace(',', '.') : text.replaceAll(',', '');
  }
  const price = Number(text);
  if (!Number.isFinite(price) || price < 0) throw new CollectionError('PRICE_INVALID', 'Fiyat değeri geçersiz.');
  return price;
}

function stockValue(value) {
  const text = String(value ?? '').toLowerCase();
  if (/outofstock|soldout|out_of_stock|tukendi|stokta-yok/.test(text)) return false;
  if (/instock|in_stock|limitedavailability|stokta/.test(text)) return true;
  return null;
}

function* walkJson(value) {
  if (Array.isArray(value)) {
    for (const child of value) yield* walkJson(child);
  } else if (value && typeof value === 'object') {
    yield value;
    for (const child of Object.values(value)) yield* walkJson(child);
  }
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

export function extractOffer(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    if (!/application\/ld\+json/i.test(attribute(match[1], 'type') ?? '')) continue;
    try {
      const payload = JSON.parse(match[2].trim());
      for (const item of walkJson(payload)) {
        const type = String(item['@type'] ?? '').toLowerCase();
        if (!type.includes('offer') && item.price == null && item.lowPrice == null) continue;
        const rawPrice = item.price ?? item.lowPrice ?? item.priceSpecification?.price;
        if (rawPrice == null) continue;
        try {
          return {
            price: parseDecimal(rawPrice),
            currency: item.priceCurrency ? String(item.priceCurrency).toUpperCase() : null,
            inStock: stockValue(item.availability),
            title: item.name ? String(item.name) : title,
            method: 'json-ld',
          };
        } catch (error) {
          if (!(error instanceof CollectionError)) throw error;
        }
      }
    } catch {
      // Invalid JSON-LD blocks are ignored; supported meta fields are tried next.
    }
  }

  let price = null;
  let currency = null;
  let inStock = null;
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (attribute(tag, 'property') ?? attribute(tag, 'itemprop') ?? attribute(tag, 'name') ?? '').toLowerCase();
    const content = attribute(tag, 'content') ?? '';
    if (price == null && ['product:price:amount', 'og:price:amount', 'price'].includes(key)) {
      try { price = parseDecimal(content); } catch { /* Try another supported field. */ }
    } else if (['product:price:currency', 'og:price:currency', 'pricecurrency'].includes(key)) {
      currency = content.toUpperCase() || null;
    } else if (['availability', 'product:availability'].includes(key)) {
      inStock = stockValue(content);
    }
  }
  if (price != null) return { price, currency, inStock, title, method: 'meta' };
  throw new CollectionError('PRICE_NOT_FOUND', 'Sayfada desteklenen yapılandırılmış fiyat alanı bulunamadı.');
}

function isPrivateAddress(address) {
  if (address === '::1' || address === '::' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) return true;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const candidate = mapped ?? address;
  if (isIP(candidate) !== 4) return false;
  const [a, b] = candidate.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

async function validatePublicUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new CollectionError('URL_INVALID', 'Geçersiz URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new CollectionError('URL_INVALID', 'Yalnızca kimlik bilgisi içermeyen HTTP/HTTPS URL’leri desteklenir.');
  }
  if (url.port && !['80', '443'].includes(url.port)) throw new CollectionError('URL_PORT_BLOCKED', 'Standart dışı URL portu engellendi.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) {
    throw new CollectionError('URL_PRIVATE_HOST', 'Özel ağ adresleri izlenemez.');
  }
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new CollectionError('URL_PRIVATE_HOST', 'Özel ağ adresleri izlenemez.');
  }
  return url;
}

async function readBody(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new CollectionError('RESPONSE_TOO_LARGE', 'Sayfa boyutu güvenli sınırı aşıyor.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function safeFetch(rawUrl, { accept = 'text/html,application/xhtml+xml', maxBytes = MAX_HTML_BYTES } = {}) {
  let url = await validatePublicUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'tr-TR,tr;q=0.9,en;q=0.7' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) throw new CollectionError('REDIRECT_LIMIT', 'Çok fazla yönlendirme.');
      const location = response.headers.get('location');
      if (!location) throw new CollectionError('REDIRECT_INVALID', 'Yönlendirme adresi eksik.');
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    const body = await readBody(response, maxBytes);
    return { response, body, url };
  }
  throw new CollectionError('REDIRECT_LIMIT', 'Çok fazla yönlendirme.');
}

function pathRuleMatches(rule, pathname) {
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  const end = escaped.endsWith('$') ? '' : '.*';
  return new RegExp(`^${escaped}${end}`).test(pathname);
}

export function robotsAllows(text, targetUrl, userAgent = USER_AGENT) {
  const groups = [];
  let group = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || group.hasRules) { group = { agents: [], rules: [], hasRules: false }; groups.push(group); }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === 'allow' || key === 'disallow')) {
      group.hasRules = true;
      if (value) group.rules.push({ type: key, path: value });
    }
  }
  const agent = userAgent.toLowerCase();
  const specific = groups.filter((item) => item.agents.some((value) => value !== '*' && agent.includes(value)));
  const applicable = specific.length ? specific : groups.filter((item) => item.agents.includes('*'));
  const pathname = new URL(targetUrl).pathname + new URL(targetUrl).search;
  const rules = applicable.flatMap((item) => item.rules).filter((rule) => pathRuleMatches(rule.path, pathname));
  if (!rules.length) return true;
  rules.sort((a, b) => b.path.length - a.path.length || (a.type === 'allow' ? -1 : 1));
  return rules[0].type === 'allow';
}

async function assertRobotsAllowed(url) {
  const robotsUrl = new URL('/robots.txt', url).toString();
  try {
    const { response, body } = await safeFetch(robotsUrl, { accept: 'text/plain,*/*;q=0.1', maxBytes: 512_000 });
    if (response.status === 404 || response.status === 410) return;
    if (response.status === 401 || response.status === 403) throw new CollectionError('ROBOTS_DENIED', 'robots.txt otomatik kontrole izin vermiyor.');
    if (response.ok && !robotsAllows(body, url)) throw new CollectionError('ROBOTS_DENIED', 'robots.txt otomatik kontrole izin vermiyor.');
  } catch (error) {
    if (error instanceof CollectionError && error.code === 'ROBOTS_DENIED') throw error;
    // Network errors while retrieving robots.txt do not imply a prohibition.
  }
}

export async function fetchOffer(url) {
  await assertRobotsAllowed(url);
  const { response, body } = await safeFetch(url);
  if (!response.ok) throw new CollectionError(`HTTP_${response.status}`, `Ürün sayfası HTTP ${response.status} döndürdü.`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('html')) throw new CollectionError('CONTENT_TYPE', 'Ürün sayfası HTML döndürmedi.');
  return extractOffer(body);
}

function publicError(error) {
  if (error instanceof CollectionError) return { code: error.code, message: error.message };
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { code: 'TIMEOUT', message: 'Sayfa zaman aşımına uğradı.' };
  return { code: 'COLLECTION_FAILED', message: 'Fiyat güvenilir biçimde alınamadı.' };
}

function stateChanged(previous, current) {
  if (!previous) return null;
  if (previous.error_code || current.errorCode) {
    if (previous.error_code === current.errorCode) return null;
    return current.errorCode ? `${current.merchant}: erişim sorunu (${current.errorCode})` : `${current.merchant}: erişim yeniden sağlandı`;
  }
  if (Number(previous.is_price_anomaly) !== Number(current.isAnomaly)) {
    return current.isAnomaly ? `${current.merchant}: aşırı fiyat düşüşü filtresine takıldı` : `${current.merchant}: fiyat yeniden geçerli aralığa döndü`;
  }
  if (Number(previous.price) !== Number(current.price)) return `${current.merchant}: ${previous.price} → ${current.price} ${current.currency}`;
  if (previous.in_stock != null && current.inStock != null && Boolean(previous.in_stock) !== Boolean(current.inStock)) {
    return `${current.merchant}: stok durumu ${current.inStock ? 'stokta' : 'tükendi'} olarak değişti`;
  }
  return null;
}

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PRICE_ALERT_FROM;
  if (!apiKey || !from) return { status: 'not_configured', messageId: null };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CollectionError('EMAIL_FAILED', payload.message || 'E-posta gönderilemedi.');
  return { status: 'sent', messageId: payload.id ?? null };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function monitorAll(pool, { concurrency = 3 } = {}) {
  const lock = await pool.getConnection();
  const [[lockRow]] = await lock.query("SELECT GET_LOCK('price-optimize-monitor',0) AS acquired");
  if (!lockRow.acquired) {
    lock.release();
    return { status: 'already_running', checked: 0, changed: 0, emailsSent: 0 };
  }
  try {
    const [sources] = await pool.query(`
      SELECT s.id,s.organization_id,s.merchant,s.url,p.id AS product_id,p.sku,p.name AS product_name,
             p.currency AS product_currency,p.max_price_drop_pct,c.id AS client_id,c.name AS client_name,
             c.notification_email,c.notification_email_verified_at,
             latest.price AS previous_price,latest.currency AS previous_currency,latest.in_stock AS previous_in_stock,
             latest.error_code AS previous_error_code,latest.is_price_anomaly AS previous_is_price_anomaly,
             accepted.price AS reference_price
      FROM competitor_sources s
      JOIN products p ON p.id=s.product_id AND p.organization_id=s.organization_id
      JOIN clients c ON c.id=p.client_id AND c.organization_id=p.organization_id
      LEFT JOIN observations latest ON latest.id=(
        SELECT o1.id FROM observations o1 WHERE o1.source_id=s.id ORDER BY o1.checked_at DESC,o1.id DESC LIMIT 1
      )
      LEFT JOIN observations accepted ON accepted.id=(
        SELECT o2.id FROM observations o2 WHERE o2.source_id=s.id AND o2.price IS NOT NULL
          AND o2.error_code IS NULL AND o2.is_price_anomaly=FALSE ORDER BY o2.checked_at DESC,o2.id DESC LIMIT 1
      )
      JOIN organizations org ON org.id=s.organization_id AND org.status='active'
      JOIN subscriptions sub ON sub.organization_id=org.id AND sub.state IN ('trialing','active')
        AND (sub.state='active' OR sub.trial_ends_at>CURRENT_TIMESTAMP(3))
      WHERE s.active=TRUE AND s.deleted_at IS NULL AND p.active=TRUE AND p.deleted_at IS NULL
        AND c.active=TRUE AND c.deleted_at IS NULL
      ORDER BY s.id
    `);

    const results = await mapLimit(sources, concurrency, async (source) => {
      const previous = source.previous_price == null && source.previous_error_code == null ? null : {
        price: source.previous_price,
        currency: source.previous_currency,
        in_stock: source.previous_in_stock,
        error_code: source.previous_error_code,
        is_price_anomaly: source.previous_is_price_anomaly,
      };
      let current;
      try {
        const offer = await fetchOffer(source.url);
        const currency = offer.currency || source.product_currency;
        if (currency !== source.product_currency) {
          current = {
            ...source,
            ...offer,
            currency,
            errorCode: 'CURRENCY_MISMATCH',
            errorMessage: `Beklenen ${source.product_currency}, sayfada ${currency} bulundu.`,
            isAnomaly: false,
            referencePrice: null,
            dropPct: null,
          };
        } else {
          const reference = source.reference_price == null ? null : Number(source.reference_price);
          const dropPct = reference > 0 ? ((reference - offer.price) / reference) * 100 : null;
          const isAnomaly = dropPct != null && dropPct >= Number(source.max_price_drop_pct);
          current = { ...source, ...offer, currency, errorCode: null, isAnomaly, referencePrice: reference, dropPct };
        }
      } catch (error) {
        const failure = publicError(error);
        current = { ...source, price: null, currency: null, inStock: null, errorCode: failure.code, errorMessage: failure.message, isAnomaly: false, referencePrice: null, dropPct: null };
      }

      const anomalyReason = current.isAnomaly
        ? `Fiyat son geçerli ${current.referencePrice} değerinden %${current.dropPct.toFixed(2)} düştü; %${Number(source.max_price_drop_pct).toFixed(2)} eşiği nedeniyle en iyi fiyat hesabından çıkarıldı.`
        : null;
      await pool.execute(`
        INSERT INTO observations(organization_id,source_id,price,currency,in_stock,error_code,is_price_anomaly,
          anomaly_reason,reference_price,drop_pct,retention_until)
        VALUES(?,?,?,?,?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 730 DAY))
      `, [source.organization_id, source.id, current.price, current.currency, current.inStock, current.errorCode,
        current.isAnomaly, anomalyReason, current.referencePrice, current.dropPct]);
      return { ...current, change: stateChanged(previous, current) };
    });

    const byClient = new Map();
    for (const result of results.filter((item) => item.change)) {
      if (!byClient.has(result.client_id)) byClient.set(result.client_id, { source: result, changes: [] });
      byClient.get(result.client_id).changes.push(result.change);
    }

    let emailsSent = 0;
    const emailFailures = [];
    for (const { source, changes } of byClient.values()) {
      if (!source.notification_email || !source.notification_email_verified_at) continue;
      try {
        const valid = results.filter((item) => item.client_id === source.client_id && item.price != null && !item.errorCode && !item.isAnomaly && item.inStock !== false && item.currency === item.product_currency);
        const best = valid.sort((a, b) => a.price - b.price)[0];
        let text = `Merhaba,\n\n${source.client_name} için rakip fiyat takibinde değişiklik tespit edildi:\n\n${changes.map((item) => `- ${item}`).join('\n')}`;
        if (best) text += `\n\nEn iyi geçerli fiyat: ${best.price} ${best.currency} (${best.merchant})`;
        text += '\n\n%25 veya üzerindeki aşırı düşüşler en iyi fiyat hesabına dahil edilmez.';
        const sent = await sendEmail({ to: source.notification_email, subject: `Rakip fiyat değişikliği: ${source.client_name}`, text });
        if (sent.status === 'sent') emailsSent += 1;
      } catch (error) {
        emailFailures.push({ clientId: source.client_id, code: publicError(error).code });
      }
    }

    await pool.execute(`DELETE FROM observations WHERE retention_until<CURRENT_TIMESTAMP(3)`);
    return {
      status: emailFailures.length ? 'completed_with_email_errors' : 'completed',
      checked: results.length,
      successful: results.filter((item) => !item.errorCode).length,
      failed: results.filter((item) => item.errorCode).length,
      changed: results.filter((item) => item.change).length,
      anomalies: results.filter((item) => item.isAnomaly).length,
      emailsSent,
      emailFailures,
      results: results.map((item) => ({ sourceId: item.id, merchant: item.merchant, status: item.errorCode ? 'error' : 'ok', errorCode: item.errorCode, isPriceAnomaly: item.isAnomaly })),
    };
  } finally {
    await lock.query("SELECT RELEASE_LOCK('price-optimize-monitor')").catch(() => {});
    lock.release();
  }
}
