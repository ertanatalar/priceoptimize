const APP_ORIGIN = 'https://price-optimizer-ertan.learnandteachcode.chatgpt.site';
const statusElement = document.querySelector('#status');
const form = document.querySelector('#captureForm');
const titleInput = document.querySelector('#title');
const priceInput = document.querySelector('#price');
const currencyInput = document.querySelector('#currency');
const stockInput = document.querySelector('#inStock');
let capture = null;

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
  for (const selector of ['[data-testid="price-current-price"]', '[data-test-id="price-current-price"]', '.prc-dsc', '.prc-slg', '[class*="current-price"]']) {
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

initialize().catch(() => showError('Sayfadaki fiyat okunamadı. Fiyatı ürün sayfasında gördüğünüzden emin olun.'));
