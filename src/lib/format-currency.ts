// Manual formatting instead of Intl.NumberFormat's currency style — Hermes'
// bundled ICU data doesn't reliably cover every currency symbol across
// platforms, and GTQ's "Q" symbol isn't part of Intl's currency-display
// output anyway. Revisit if Stage 10 (multi-currency) needs richer locale
// formatting (grouping separators, decimal styles per locale).
const CURRENCY_SYMBOLS: Record<string, string> = {
  GTQ: 'Q',
  USD: '$',
  EUR: '€',
};

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
