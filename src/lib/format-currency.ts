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
