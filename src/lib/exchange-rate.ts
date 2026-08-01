import type { CurrencyCode } from '@/types/firestore';

// Live rate lookup (FR-17) — a convenience on top of the manual-entry field
// that's always available and required offline. No API key, free tier, ISO
// 4217 coverage confirmed to include every SUPPORTED_CURRENCIES entry.
// Attribution required by the provider's terms: "Rates By Exchange Rate
// API" (see the "Fetch rate" UI in the forms that call this).
const EXCHANGE_RATE_API_BASE = 'https://open.er-api.com/v6/latest';

export class ExchangeRateFetchError extends Error {}

type ExchangeRateApiResponse = {
  result: string;
  rates: Record<string, number>;
};

// Returns how many units of `to` one unit of `from` is worth — i.e. the
// same direction as exchangeRateToDefault (from = record's own currency,
// to = the app's default currency), so callers can assign the result
// directly.
export async function fetchExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  let response: Response;
  try {
    response = await fetch(`${EXCHANGE_RATE_API_BASE}/${from}`);
  } catch {
    throw new ExchangeRateFetchError('Network request failed while fetching the exchange rate.');
  }

  if (!response.ok) {
    throw new ExchangeRateFetchError(`Exchange rate request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (data.result !== 'success') {
    throw new ExchangeRateFetchError('Exchange rate provider reported an unsuccessful result.');
  }

  const rate = data.rates[to];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new ExchangeRateFetchError(`No exchange rate available for ${to}.`);
  }

  return rate;
}
