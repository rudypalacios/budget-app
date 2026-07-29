// Centralized amount-text handling for every amount TextField in the app —
// mirrors format-currency.ts's role for output, but for input parsing. Both
// digits-only separators (period, comma) are accepted since they're the
// only two decimal separators used across this app's supported locales
// (Spanish + English, see docs/SRS-presupuesto-app.md).
//
// Deliberately still a simple universal normalization (comma treated as a
// period), not full per-locale thousands-grouping parsing, even now that
// Stage 10 (localization) makes a real language field available: stripping
// "." as a thousands separator under an es locale would silently
// misinterpret a plainly-typed decimal like "12.34" as "1234" (a 100x
// amount error) — the ambiguity between "grouping separator" and "decimal
// separator" can't be resolved from the digits alone without also
// constraining input to a stricter masked format than a plain TextField
// gives us today. Revisit as a dedicated input-masking feature, not a
// one-line parse change, if this ever needs to support typed thousands
// separators.

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
