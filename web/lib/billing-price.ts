/** The public monthly offer must match the recurring Paddle price. */
export function isStarterMonthlyPrice(price: {
  status?: string;
  unit_price?: { amount?: string; currency_code?: string };
  billing_cycle?: { interval?: string; frequency?: number } | null;
}) {
  return price.status === 'active' && price.unit_price?.amount === '2900'
    && price.unit_price.currency_code === 'USD'
    && price.billing_cycle?.interval === 'month' && price.billing_cycle.frequency === 1;
}
