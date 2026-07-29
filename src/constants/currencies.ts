export type CurrencyDefinition = {
  code: string;
  label: string;
  symbol: string;
};

// Single source of truth for the app's currently-supported currencies —
// used by both the Settings picker and formatCurrency's symbol lookup.
// Expanding this list is Stage 11's job (multi-currency, FR-15).
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'GTQ', label: 'GTQ — Guatemalan Quetzal', symbol: 'Q' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
];

const SYMBOL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency.symbol]),
);

export function getCurrencySymbol(currencyCode: string): string {
  return SYMBOL_BY_CODE[currencyCode] ?? `${currencyCode} `;
}
