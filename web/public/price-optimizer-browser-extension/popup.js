const APP_ORIGIN = 'https://www.priceoptimize.ai';
const statusElement = document.querySelector('#status');
const form = document.querySelector('#captureForm');
const titleInput = document.querySelector('#title');
const priceInput = document.querySelector('#price');
const currencyInput = document.querySelector('#currency');
const stockInput = document.querySelector('#inStock');
const batchFileInput = document.querySelector('#batchFile');
const batchStatus = document.querySelector('#batchStatus');
const startBatchButton = document.querySelector('#startBatch');
const cancelBatchButton = document.querySelector('#cancelBatch');
let capture = null;
let batchSources = [];

function showError(message) {
  statusElement.textContent = message;
  statusElement.className = 'status error';
  form.hidden = true;
}

function extractPageOffer() {
  function decimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
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
  const namedSource = /^priceoptimize-source-(\d+)$/.exec(window.name)?.[1] || null;
  const sourceId = currentUrl.searchParams.get('priceoptimize_source')
    || new URLSearchParams(location.hash.slice(1)).get('priceoptimize-source')
    || namedSource;
  currentUrl.searchParams.delete('priceoptimize_source');
  currentUrl.hash = '';
  const selected = candidates[0] || null;
  return { sourceId, pageUrl: currentUrl.toString(), title: document.title, price: selected?.price || null, currency: String(selected?.currency || 'TRY').toUpperCase(), inStock: !/tükendi|stokta yok|out of stock/i.test(document.body.innerText) };
}

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || '')) return showError('Önce paneldeki tarayıcı simgesiyle bir ürün sayfası açın.');
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageOffer });
  capture = result;
  const sourceId = String(capture?.sourceId ?? '').trim();
  if (!/^\d+$/.test(sourceId) || Number(sourceId) <= 0) return showError('Bu sayfa paneldeki ekran simgesiyle açılmadı. Panele dönüp mağaza satırındaki ilk simgeye basın.');
  capture.sourceId = sourceId;
  statusElement.hidden = true;
  form.hidden = false;
  titleInput.value = capture.title || 'Rakip ürün';
  priceInput.value = capture.price || '';
  currencyInput.value = capture.currency || 'TRY';
  stockInput.checked = capture.inStock !== false;
  if (!capture.price) priceInput.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = new URLSearchParams({ sourceId: capture.sourceId, pageUrl: capture.pageUrl, title: capture.title || 'Rakip ürün', price: priceInput.value, currency: currencyInput.value.toUpperCase(), inStock: String(stockInput.checked) });
  await chrome.tabs.create({ url: `${APP_ORIGIN}/capture?${query.toString()}` });
  window.close();
});

batchFileInput.addEventListener('change', async () => {
  batchSources = [];
  const file = batchFileInput.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.format !== 'priceoptimize-browser-queue-v1' || !Array.isArray(payload.sources) || !payload.sources.length) throw new Error();
    batchSources = payload.sources;
    batchStatus.textContent = `${batchSources.length} URL sıraya alındı.`;
    batchStatus.className = 'status';
  } catch {
    batchStatus.textContent = 'Bu dosya geçerli bir Price Optimizer kontrol listesi değil.';
    batchStatus.className = 'status error';
  }
});

startBatchButton.addEventListener('click', async () => {
  if (!batchSources.length) {
    batchStatus.textContent = 'Önce panelden indirdiğiniz kontrol listesini seçin.';
    batchStatus.className = 'status error';
    return;
  }
  let origins;
  try { origins = [...new Set(batchSources.map((source) => `${new URL(source.url).origin}/*`))]; }
  catch { batchStatus.textContent = 'Listede geçersiz ürün adresi var.'; batchStatus.className = 'status error'; return; }
  const granted = await chrome.permissions.request({ origins });
  if (!granted) {
    batchStatus.textContent = 'Toplu kontrol için listedeki mağazalara erişim izni verilmelidir.';
    batchStatus.className = 'status error';
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: 'START_BROWSER_BATCH', sources: batchSources });
  if (!response?.ok) {
    batchStatus.textContent = response?.error || 'Toplu kontrol başlatılamadı.';
    batchStatus.className = 'status error';
    return;
  }
  await refreshBatchStatus();
});

cancelBatchButton.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL_BROWSER_BATCH' });
  await refreshBatchStatus();
});

async function refreshBatchStatus() {
  const { browserBatchState: state } = await chrome.storage.local.get('browserBatchState');
  const running = state?.status === 'running';
  startBatchButton.disabled = running;
  cancelBatchButton.hidden = !running;
  if (!state) return;
  const completed = Number(state.index || 0);
  const total = Number(state.sources?.length || 0);
  if (running) batchStatus.textContent = `${completed}/${total} tamamlandı. Başarılı: ${state.results?.length || 0}, inceleme: ${state.failures?.length || 0}. Chrome’u açık bırakın.`;
  else if (state.status === 'completed') batchStatus.textContent = `Tamamlandı. ${state.results?.length || 0} sonuç indirildi; ${state.failures?.length || 0} kayıt inceleme bekliyor.`;
  else if (state.status === 'cancelled') batchStatus.textContent = 'İşlem durduruldu. Tamamlanan sonuçlar indirildi.';
  batchStatus.className = 'status';
}

chrome.storage.onChanged.addListener((changes) => { if (changes.browserBatchState) void refreshBatchStatus(); });
void refreshBatchStatus();

initialize().catch(() => showError('Sayfadaki fiyat okunamadı. Fiyatı ürün sayfasında gördüğünüzden emin olun.'));
