import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBrowserQueue,
  type BrowserQueueSource,
} from './browser-queue.ts';

const sources: BrowserQueueSource[] = [
  {
    id: 1,
    url: 'https://a.example/1',
    merchant: 'A',
    productId: 10,
    productName: 'Telefon',
    clientName: 'Müşteri',
    currency: 'TRY',
  },
  {
    id: 2,
    url: 'https://b.example/2',
    merchant: 'B',
    productId: 20,
    productName: 'Tablet',
    clientName: 'Müşteri',
    currency: 'TRY',
  },
];

test('creates one browser queue for every product group', () => {
  const queue = createBrowserQueue(sources, {
    generatedAt: '2026-09-19T00:00:00.000Z',
  });
  assert.equal(queue.scope, 'all-products');
  assert.equal(queue.productCount, 2);
  assert.deepEqual(
    queue.sources.map((source) => source.id),
    [1, 2],
  );
});

test('can still create a queue for only the selected product', () => {
  const queue = createBrowserQueue(sources, { productId: 20 });
  assert.equal(queue.scope, 'selected-product');
  assert.equal(queue.productCount, 1);
  assert.deepEqual(
    queue.sources.map((source) => source.id),
    [2],
  );
});
