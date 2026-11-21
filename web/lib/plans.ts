export const STARTER_PLAN = {
  code: 'starter', name: 'Başlangıç', monthlyPriceUsd: 29, sourceLimit: 50,
  trialDays: 30, trialSourceLimit: 10,
} as const;

export function sourceLimitForState(state: string) {
  return state === 'trialing' ? STARTER_PLAN.trialSourceLimit : STARTER_PLAN.sourceLimit;
}
