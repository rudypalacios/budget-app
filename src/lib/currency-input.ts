// Centralized amount-text handling for every amount TextField in the app —
// mirrors format-currency.ts's role for output, but for input parsing. Both
// digits-only separators (period, comma) are accepted since they're the
// only two decimal separators used across this app's supported locales
// (Spanish + English, see docs/SRS-presupuesto-app.md). This is a simple
// universal normalization (comma treated as a period), not true
// locale-aware masking/grouping — revisit once Settings has a
// region/locale field (Stage 10, localization) to drive a real per-locale
// mask, same caveat as formatCurrency's Intl.NumberFormat note above.

// Applied on every keystroke (onChangeText) — strips anything that isn't
// part of a decimal amount, so the field can never contain letters or
// currency symbols.
export function sanitizeAmountInput(text: string): string {
  return text.replace(/[^0-9.,]/g, '');
}

// Applied when reading the field's value for validation/submission —
// normalizes a comma decimal separator (e.g. "12,34") to a period so
// Number() parses it correctly; Number() itself rejects commas outright.
export function parseAmountInput(text: string): number {
  return Number(text.replace(',', '.'));
}
