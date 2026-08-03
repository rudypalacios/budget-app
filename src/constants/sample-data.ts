// Sample monthly rolling-average totals used by the History screen (Stage 5
// UI, FR-7's whole-budget chart — a different aggregate from the Budget
// screen's per-category monthlyBudget, see Category.monthlyBudget/Stage 13).
// Not read from Firestore — stays a placeholder until a future stage wires
// the History chart to real data.

export type SampleMonthlyTotal = {
  label: string;
  actual: number | null;
  budgeted: number;
  rollingAverage: number | null;
};

// FR-7: aggregate actual/budgeted/6-month-rolling-average per month.
export const sampleMonthlyTotals: SampleMonthlyTotal[] = [
  { label: 'Feb', actual: 6100, budgeted: 6350, rollingAverage: null },
  { label: 'Mar', actual: 6420, budgeted: 6350, rollingAverage: null },
  { label: 'Apr', actual: 5950, budgeted: 6350, rollingAverage: null },
  { label: 'May', actual: 6600, budgeted: 6350, rollingAverage: null },
  { label: 'Jun', actual: 6300, budgeted: 6350, rollingAverage: 6274 },
  { label: 'Jul', actual: 6450, budgeted: 6350, rollingAverage: 6303 },
];
