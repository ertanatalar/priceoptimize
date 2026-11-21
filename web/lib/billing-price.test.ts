import assert from 'node:assert/strict';
import test from 'node:test';
import { isStarterMonthlyPrice } from './billing-price.ts';

const monthly = { status: 'active', unit_price: { amount: '2900', currency_code: 'USD' }, billing_cycle: { interval: 'month', frequency: 1 } };
test('only the advertised 29 USD monthly recurring price passes', () => {
  assert.equal(isStarterMonthlyPrice(monthly), true);
  for (const price of [
    { ...monthly, status: 'archived' },
    { ...monthly, unit_price: { amount: '5900', currency_code: 'USD' } },
    { ...monthly, unit_price: { amount: '2900', currency_code: 'EUR' } },
    { ...monthly, billing_cycle: null },
    { ...monthly, billing_cycle: { interval: 'year', frequency: 1 } },
    { ...monthly, billing_cycle: { interval: 'month', frequency: 12 } },
  ]) assert.equal(isStarterMonthlyPrice(price), false);
});
