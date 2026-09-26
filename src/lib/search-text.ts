// Folds case and accents so a search for "espanol" matches "Español" — used
// by Settings' language filter (Ajustes redesign, §4.3). NFD splits an
// accented letter into base letter + combining mark; the regex drops the
// marks (Unicode block U+0300–U+036F).
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
