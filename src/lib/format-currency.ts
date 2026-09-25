import { getCurrencyFormatLocale, getCurrencySymbol } from '@/constants/currencies';
import i18n from '@/localization/i18n';

// Manual symbol lookup instead of Intl.NumberFormat's currency style —
// Hermes' bundled ICU data doesn't reliably cover every currency symbol
// across platforms, and GTQ's "Q" symbol isn't part of Intl's
// currency-display output anyway.
//
// Grouping/decimal-separator style is driven by the CURRENCY, not the app's
// active UI language — a $ amount reads as "$1,234.56" and a € amount reads
// as "€1.234,56" the same way regardless of whether the viewer has the app
// set to Spanish or English, matching each currency's own real-world
// convention (see SUPPORTED_CURRENCIES' formatLocale). Confirmed live that
// switching UI language must NOT re-format an unrelated currency's amounts —
// that was the actual bug this replaced (every currency was flipping to
// comma-decimal together whenever the UI language was Spanish). The current
// UI language is only used as a fallback for a currency outside
// SUPPORTED_CURRENCIES, where there's no known convention to anchor to.
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const locale = getCurrencyFormatLocale(currency) ?? (i18n.language === 'es' ? 'es' : 'en');
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

// Redesign (v9): a money-flow figure with its direction shown as a sign
// before the symbol — "−Q 592.85", "+Q 20,974.67" — rather than the plain
// "Q -592.85" formatCurrency gives. Uses a real minus sign (U+2212), which
// lines up with "+" in proportional fonts. `showPlus` marks money coming in;
// without it, positive values stay unsigned (a balance, not a flow). Zero is
// never signed.
export function formatSignedCurrency(
  amount: number,
  currency: string,
  { showPlus = false }: { showPlus?: boolean } = {},
): string {
  const magnitude = formatCurrency(Math.abs(amount), currency);
  if (amount < 0) return `\u2212${magnitude}`;
  if (amount > 0 && showPlus) return `+${magnitude}`;
  return magnitude;
}

// Stage 11 (FR-18): a record's own amount/currency alongside its
// default-currency equivalent, e.g. "$ 1.00 (Q 8.00)" — used anywhere a
// single record's own currency is displayed and may differ from the
// user's default currency (History rows, Payments dashboard rows). Falls
// back to plain formatCurrency (no parenthetical) when the record is
// already in the default currency, matching every other amount in the app.
export function formatCurrencyWithConversion(
  amount: number,
  currency: string,
  amountInDefaultCurrency: number,
  defaultCurrency: string,
): string {
  if (currency === defaultCurrency) {
    return formatCurrency(amount, currency);
  }
  return `${formatCurrency(amount, currency)} (${formatCurrency(amountInDefaultCurrency, defaultCurrency)})`;
}
