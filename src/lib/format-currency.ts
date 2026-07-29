import { getCurrencySymbol } from '@/constants/currencies';
import i18n from '@/localization/i18n';

// Manual symbol lookup instead of Intl.NumberFormat's currency style —
// Hermes' bundled ICU data doesn't reliably cover every currency symbol
// across platforms, and GTQ's "Q" symbol isn't part of Intl's
// currency-display output anyway. Grouping/decimal-separator style still
// comes from Intl, driven by the current UI language (the closest thing to
// a region setting this app has — see currency-input.ts's parseAmountInput
// for the matching parse-side logic).
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  // Generic 'es'/'en' language tags, not region-pinned ones — this app's
  // language setting has no separate region field (see currency-input.ts's
  // comment), and CLDR's es-GT/es-MX regional data actually formats like
  // en-US (comma grouping, period decimal), which would make Spanish mode
  // visually indistinguishable from English for exactly this app's default
  // currency's home country. Generic 'es' gives the recognizably-Spanish
  // period-grouping/comma-decimal style users selecting Español expect.
  const locale = i18n.language === 'es' ? 'es' : 'en';
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
