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
// lookup. Expanded for Stage 11 (multi-currency, FR-15).
//
// formatLocale is each currency's own real-world grouping/decimal
// convention, verified with Intl.NumberFormat against 1234.56 for the
// country's actual locale tag rather than assumed from a generic 'en'/'es'
// split — Spanish-speaking countries don't all share one convention (e.g.
// Peru matches en-US's comma-grouping/period-decimal style, while Costa
// Rica genuinely space-groups: "1 234,56").
//
// Note: CLP's real convention has 0 decimal places, but formatCurrency
// hardcodes 2 for every currency uniformly — an existing simplification
// (never surfaced before GTQ/USD/EUR, all naturally 2-decimal), not fixed
// here since it would need a per-currency decimals field, beyond FR-14–18.
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'GTQ', label: 'GTQ — Guatemalan Quetzal', symbol: 'Q', formatLocale: 'en' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$', formatLocale: 'en' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€', formatLocale: 'es' },
  { code: 'MXN', label: 'MXN — Mexican Peso', symbol: '$', formatLocale: 'es-MX' },
  { code: 'CAD', label: 'CAD — Canadian Dollar', symbol: 'CA$', formatLocale: 'en-CA' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£', formatLocale: 'en-GB' },
  { code: 'COP', label: 'COP — Colombian Peso', symbol: '$', formatLocale: 'es-CO' },
  { code: 'ARS', label: 'ARS — Argentine Peso', symbol: '$', formatLocale: 'es-AR' },
  { code: 'CLP', label: 'CLP — Chilean Peso', symbol: '$', formatLocale: 'es-CL' },
  { code: 'PEN', label: 'PEN — Peruvian Sol', symbol: 'S/', formatLocale: 'es-PE' },
  { code: 'BRL', label: 'BRL — Brazilian Real', symbol: 'R$', formatLocale: 'pt-BR' },
  { code: 'DOP', label: 'DOP — Dominican Peso', symbol: 'RD$', formatLocale: 'es-DO' },
  { code: 'HNL', label: 'HNL — Honduran Lempira', symbol: 'L', formatLocale: 'es-HN' },
  { code: 'CRC', label: 'CRC — Costa Rican Colón', symbol: '₡', formatLocale: 'es-CR' },
  { code: 'PAB', label: 'PAB — Panamanian Balboa', symbol: 'B/.', formatLocale: 'es-PA' },
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
