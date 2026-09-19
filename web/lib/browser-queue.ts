export type BrowserQueueSource = {
  id: number;
  url: string;
  merchant: string;
  productId: number;
  productName: string;
  clientName: string;
  currency: string;
};

export function createBrowserQueue(
  sources: BrowserQueueSource[],
  {
    productId,
    generatedAt = new Date().toISOString(),
  }: { productId?: number; generatedAt?: string } = {},
) {
  const selected =
    productId == null
      ? sources
      : sources.filter((source) => source.productId === productId);
  return {
    format: 'priceoptimize-browser-queue-v1',
    scope: productId == null ? 'all-products' : 'selected-product',
    generatedAt,
    productCount: new Set(selected.map((source) => source.productId)).size,
    sources: selected.map(
      ({ id, url, merchant, productName, clientName, currency }) => ({
        id,
        url,
        merchant,
        productName,
        clientName,
        currency,
      }),
    ),
  };
}
