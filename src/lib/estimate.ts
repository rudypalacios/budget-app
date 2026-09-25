// The app's one standard way to estimate a "normal" value from a short
// history (Presupuesto redesign D12): drop outliers with Tukey's IQR rule,
// then average what's left. Used by every estimate the app shows — a
// category's suggested budget (budget-status.ts) and a recurring expense's
// 6-month average behind its budget recommendation (budget-recommendation.ts)
// — so a one-off spike (an appliance purchase, a billing error) never skews
// either, and both explain themselves the same way.

// Below this many values there's too little data to call any one of them an
// outlier, so the estimate is a plain average.
const MIN_VALUES_FOR_OUTLIER_FILTER = 4;

// Tukey's fence multiplier — the standard 1.5 × IQR outlier rule.
const TUKEY_FENCE = 1.5;

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

// Tukey's rule: drop values outside [Q1 − 1.5·IQR, Q3 + 1.5·IQR]. Quartiles
// are the medians of the lower and upper halves (the middle value excluded
// when the count is odd) — the simple textbook method, fine for the ~6
// values these estimates work with. Keeps the input order.
export function withoutOutliers(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  const q1 = median(sorted.slice(0, half));
  const q3 = median(sorted.slice(sorted.length - half));
  const iqr = q3 - q1;
  const low = q1 - TUKEY_FENCE * iqr;
  const high = q3 + TUKEY_FENCE * iqr;
  return values.filter((value) => value >= low && value <= high);
}

// Average of `values` with outliers excluded (only once there are enough
// values to tell). Unrounded; null for an empty list.
export function robustAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const kept = values.length >= MIN_VALUES_FOR_OUTLIER_FILTER ? withoutOutliers(values) : values;
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}
