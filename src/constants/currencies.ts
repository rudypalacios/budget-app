export type CurrencyDefinition = {
  code: string;
  label: string;
  symbol: string;
  // The generic language tag whose Intl.NumberFormat grouping/decimal
  // convention this currency is always displayed with, regardless of the
  // app's active UI language — a currency amount's separator style is a
  // property of the currency's own convention (e.g. USD is always
  // "1,234.56", EUR is always "1.234,56"), not of whatever language the
  // viewer's UI happens to be in. See format-currency.ts.
  formatLocale: string;
};

// Single source of truth for the app's currently-supported currencies —
// used by both the Settings picker and formatCurrency's symbol/locale
// lookup. Expanding this list is Stage 11's job (multi-currency, FR-15).
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  // Guatemala's real CLDR number-formatting convention (es-GT) matches
  // en-US — comma grouping, period decimal — not the period-grouping/
  // comma-decimal style generic 'es' would give.
  { code: 'GTQ', label: 'GTQ — Guatemalan Quetzal', symbol: 'Q', formatLocale: 'en' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$', formatLocale: 'en' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€', formatLocale: 'es' },
];

const SYMBOL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency.symbol]),
);

const FORMAT_LOCALE_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency.formatLocale]),
);

export function getCurrencySymbol(currencyCode: string): string {
  return SYMBOL_BY_CODE[currencyCode] ?? `${currencyCode} `;
}

// Undefined (not a fallback locale) for a currency outside SUPPORTED_CURRENCIES —
// formatCurrency falls back to the current UI language in that case, since
// there's no known convention to anchor an unsupported currency to.
export function getCurrencyFormatLocale(currencyCode: string): string | undefined {
  return FORMAT_LOCALE_BY_CODE[currencyCode];
}
