import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOffer, parseDecimal, purgeExpiredRecords, robotsAllows } from './collector.mjs';

test('extracts a localized JSON-LD offer', () => {
  const offer = extractOffer(`<html><head><title>Test Ürün</title><script type="application/ld+json">
    {"@type":"Product","offers":{"@type":"Offer","price":"1.234,56","priceCurrency":"TRY","availability":"https://schema.org/InStock"}}
  </script></head></html>`);
  assert.equal(offer.price, 1234.56);
  assert.equal(offer.currency, 'TRY');
  assert.equal(offer.inStock, true);
  assert.equal(offer.method, 'json-ld');
});

test('extracts supported price meta tags', () => {
  const offer = extractOffer(`<meta property="product:price:amount" content="999.90">
    <meta property="product:price:currency" content="try"><meta property="product:availability" content="out_of_stock">`);
  assert.equal(offer.price, 999.9);
  assert.equal(offer.currency, 'TRY');
  assert.equal(offer.inStock, false);
});

test('parses Turkish and international decimal formats', () => {
  assert.equal(parseDecimal('₺1.234,50'), 1234.5);
  assert.equal(parseDecimal('1,234.50 TL'), 1234.5);
});

test('honors longest matching robots rule', () => {
  const robots = `User-agent: *\nDisallow: /urun/\nAllow: /urun/acik/`;
  assert.equal(robotsAllows(robots, 'https://example.com/urun/gizli'), false);
  assert.equal(robotsAllows(robots, 'https://example.com/urun/acik/1'), true);
});

test('purges every expired record category while preserving legal holds', async () => {
  const statements = [];
  const pool = {
    execute: async (sql) => {
      statements.push(sql);
      return [{ affectedRows: statements.length }];
    },
  };

  const deleted = await purgeExpiredRecords(pool);

  assert.deepEqual(deleted, { observations: 1, auditEvents: 2, erasureRecords: 3 });
  assert.equal(statements.length, 3);
  assert.match(statements[0], /observations/);
  assert.match(statements[1], /audit_events/);
  assert.match(statements[2], /legal_hold=FALSE/);
});
