const STATE_KEY = 'browserBatchState';
const NEXT_ALARM = 'priceoptimize-batch-next';
const TIMEOUT_ALARM = 'priceoptimize-batch-timeout';
const BETWEEN_PAGES_MS = 12000;
const LOAD_TIMEOUT_MS = 45000;
let processingTabId = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'START_BROWSER_BATCH') {
    startBatch(message.sources).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'CANCEL_BROWSER_BATCH') {
    finishBatch('cancelled').then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') void handleLoadedTab(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === NEXT_ALARM) void openNext();
  if (alarm.name === TIMEOUT_ALARM) void failCurrent('Sayfa 45 saniyede yüklenemedi.');
});

async function startBatch(rawSources) {
  const existing = await readState();
  if (existing?.status === 'running') throw new Error('Devam eden bir toplu kontrol zaten var.');
  const sources = (Array.isArray(rawSources) ? rawSources : []).slice(0, 1000).map((source) => ({
    id: Number(source.id),
    url: String(source.url || ''),
    merchant: String(source.merchant || ''),
    currency: String(source.currency || 'TRY').toUpperCase(),
  })).filter((source) => Number.isInteger(source.id) && source.id > 0 && /^https:\/\//i.test(source.url));
  if (!sources.length) throw new Error('Listede geçerli HTTPS ürün adresi bulunamadı.');
  await writeState({ status: 'running', sources, index: 0, results: [], failures: [], activeTabId: null, startedAt: new Date().toISOString() });
  await openNext();
}

async function openNext() {
  const state = await readState();
  if (!state || state.status !== 'running') return;
  if (state.index >= state.sources.length) return finishBatch('completed');
  if (state.activeTabId) return;
  const item = state.sources[state.index];
  const url = normalizedBrowserUrl(item.url);
  url.searchParams.set('priceoptimize_source', String(item.id));
  const tab = await chrome.tabs.create({ url: url.toString(), active: false });
  state.activeTabId = tab.id;
  await writeState(state);
  await chrome.alarms.create(TIMEOUT_ALARM, { when: Date.now() + LOAD_TIMEOUT_MS });
}

function normalizedBrowserUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (/(^|\.)amazon\.com\.tr$/i.test(url.hostname)) {
    const asin = url.pathname.match(/\/dp\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
    if (asin) {
      url.pathname = `/dp/${asin}`;
      url.search = '';
      url.hash = '';
    }
  }
  return url;
}

async function handleLoadedTab(tabId) {
  if (processingTabId === tabId) return;
  processingTabId = tabId;
  const state = await readState();
  if (!state || state.status !== 'running' || state.activeTabId !== tabId) { processingTabId = null; return; }
  await chrome.alarms.clear(TIMEOUT_ALARM);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageOffer });
    const item = state.sources[state.index];
    if (result?.error) state.failures.push({ sourceId: item.id, merchant: item.merchant, url: item.url, error: result.error });
    else if (!result?.price) state.failures.push({ sourceId: item.id, merchant: item.merchant, url: item.url, error: 'Sayfada pozitif fiyat bulunamadı.' });
    else state.results.push({ sourceId: item.id, pageUrl: result.pageUrl, price: result.price, currency: result.currency || item.currency, inStock: result.inStock });
    await advance(state);
  } catch (error) {
    await failCurrent(error instanceof Error ? error.message : 'Sayfa okunamadı.');
  } finally {
    processingTabId = null;
  }
}

async function failCurrent(error) {
  const state = await readState();
  if (!state || state.status !== 'running') return;
  const item = state.sources[state.index];
  if (item) state.failures.push({ sourceId: item.id, merchant: item.merchant, url: item.url, error });
  await advance(state);
}

async function advance(state) {
  await chrome.alarms.clear(TIMEOUT_ALARM);
  if (state.activeTabId) await chrome.tabs.remove(state.activeTabId).catch(() => undefined);
  state.activeTabId = null;
  state.index += 1;
  await writeState(state);
  await chrome.alarms.create(NEXT_ALARM, { when: Date.now() + BETWEEN_PAGES_MS });
}

async function finishBatch(status) {
  await chrome.alarms.clear(NEXT_ALARM);
  await chrome.alarms.clear(TIMEOUT_ALARM);
  const state = await readState();
  if (!state) return;
  if (state.activeTabId) await chrome.tabs.remove(state.activeTabId).catch(() => undefined);
  state.activeTabId = null;
  state.status = status;
  state.finishedAt = new Date().toISOString();
  await writeState(state);
  const payload = { format: 'priceoptimize-browser-results-v1', generatedAt: state.finishedAt, results: state.results, failures: state.failures };
  const json = JSON.stringify(payload, null, 2);
  await chrome.downloads.download({ url: `data:application/json;charset=utf-8,${encodeURIComponent(json)}`, filename: `priceoptimize-sonuclar-${state.finishedAt.slice(0, 10)}.json`, saveAs: false });
}

async function readState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY];
}

async function writeState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

function extractPageOffer() {
  function decimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
    let text = String(value || '').replace(/[^0-9,.-]/g, '');
    if (!text) return null;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) text = comma > dot ? text.replaceAll('.', '').replace(',', '.') : text.replaceAll(',', '');
    else if (comma >= 0) { const tail = text.length - comma - 1; text = tail <= 2 ? text.replaceAll('.', '').replace(',', '.') : text.replaceAll(',', ''); }
    else if (dot >= 0) { const parts = text.split('.'); text = parts.length > 2 || parts.at(-1).length === 3 ? parts.join('') : text; }
    const number = Number(text);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function walk(value, results) {
    if (Array.isArray(value)) for (const item of value) walk(item, results);
    else if (value && typeof value === 'object') {
      const type = String(value['@type'] || '').toLowerCase();
      if (type.includes('offer') || value.price != null || value.lowPrice != null) {
        const price = decimal(value.price ?? value.lowPrice ?? value.priceSpecification?.price);
        if (price) results.push({ price, currency: value.priceCurrency || value.priceSpecification?.priceCurrency });
      }
      for (const item of Object.values(value)) walk(item, results);
    }
  }
  const bodyText = document.body?.innerText || '';
  if (/captcha|robot olmadığınızı|verify you are human|access denied|erişim engellendi/i.test(`${document.title} ${bodyText.slice(0, 5000)}`)) return { error: 'CAPTCHA veya erişim engeli görüldü; bu kayıt incelemeye ayrıldı.' };
  const candidates = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(script.textContent || ''), candidates); } catch { /* geçersiz JSON-LD */ }
  }
  for (const selector of ['meta[property="product:price:amount"]', 'meta[property="og:price:amount"]', 'meta[itemprop="price"]']) {
    const element = document.querySelector(selector);
    const price = decimal(element?.getAttribute('content'));
    if (price) candidates.push({ price, currency: document.querySelector('meta[property="product:price:currency"],meta[property="og:price:currency"],meta[itemprop="priceCurrency"]')?.getAttribute('content') });
  }
  for (const selector of [
    '.priceToPay .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.product-detail-price-big .product-list__price',
    '[data-testid="price-current-price"]',
    '[data-test-id="price-current-price"]',
    '.prc-dsc',
    '.prc-slg',
    '[class*="current-price"]',
  ]) {
    const price = decimal(document.querySelector(selector)?.textContent);
    if (price) candidates.push({ price, currency: 'TRY' });
  }
  const currentUrl = new URL(location.href);
  currentUrl.searchParams.delete('priceoptimize_source');
  currentUrl.hash = '';
  const selected = candidates[0] || null;
  return { pageUrl: currentUrl.toString(), title: document.title, price: selected?.price || null, currency: String(selected?.currency || 'TRY').toUpperCase(), inStock: !/tükendi|stokta yok|out of stock/i.test(bodyText) };
}
