// Manual formatting instead of Intl.DateTimeFormat, matching
// format-currency.ts's rationale — keeps output identical across Hermes
// (native) and the JS engines behind react-native-web without relying on
// locale/ICU data being present.
const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

// e.g. "15-Jan-26" — used on the Payments dashboard next to a row's title
// for its due/paid date (src/app/(tabs)/index.tsx, the Payments screen).
export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}
