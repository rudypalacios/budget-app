import { createCollectionStore } from './create-collection-store';
import type { AddedCurrency, CurrencyCode, RateSource } from '@/types/firestore';

const store = createCollectionStore<AddedCurrency>('currencies');

export const useCurrenciesStore = store.useStore;
export const subscribeCurrencies = store.subscribe;

// Deterministic doc ID = the currency code (data-model.md §3a) — a given
// currency can only ever be added once, and this call is idempotent the
// same way recurring-instance generation's setAt calls are.
export function addCurrency(
  code: CurrencyCode,
  exchangeRateToDefault: number,
  rateSource: RateSource,
) {
  return store.setAt(code, { exchangeRateToDefault, rateSource, status: 'ok' });
}

// Re-fetch/re-enter flow (currencies/[code]/edit.tsx) — always clears
// 'stale' back to 'ok', since supplying a fresh rate is the only way a
// stale currency becomes usable again.
export function updateCurrencyRate(
  code: CurrencyCode,
  exchangeRateToDefault: number,
  rateSource: RateSource,
) {
  return store.update(code, { exchangeRateToDefault, rateSource, status: 'ok' });
}

// Safe to hard-delete (data-model.md §3a) — no other document references a
// currency doc by ID.
export function removeCurrency(code: CurrencyCode) {
  return store.remove(code);
}

// Looks up the rate to snapshot into a new/edited record at submit time
// (expenses/new.tsx, income/new.tsx, recurring-*/[id]/edit.tsx) — the
// transaction forms themselves no longer collect a rate, since
// AmountCurrencyField only ever offers already-configured currencies.
// Falls back to 1/'manual' for the default currency (implicit, never
// itself an added-currency doc) and defensively for a currency that isn't
// found (e.g. removed between render and submit).
export function getConfiguredRate(
  currency: CurrencyCode,
  defaultCurrency: CurrencyCode,
): { exchangeRateToDefault: number; rateSource: RateSource } {
  if (currency === defaultCurrency) {
    return { exchangeRateToDefault: 1, rateSource: 'manual' };
  }
  const added = store.useStore.getState().items.find((item) => item.id === currency);
  return {
    exchangeRateToDefault: added?.exchangeRateToDefault ?? 1,
    rateSource: added?.rateSource ?? 'manual',
  };
}
