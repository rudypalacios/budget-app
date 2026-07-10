// Sample per-category budget lines + monthly rolling-average totals used by
// the Budget and History screens (Stage 5 UI). Not read from Firestore —
// real per-category budgets come from recurringExpenses definitions and the
// rolling-average engine, both Stage 12; these stay as placeholders until
// then. Categories/expenses/incomes themselves are real Firestore data as of
// Stage 6 (see src/store/), so their old sample fixtures were removed here.

export type SampleBudgetLine = {
  categoryId: string;
  budgeted: number;
};

export const sampleBudgets: SampleBudgetLine[] = [
  { categoryId: 'cat-rent', budgeted: 3500 },
  { categoryId: 'cat-groceries', budgeted: 1500 },
  { categoryId: 'cat-transport', budgeted: 600 },
  { categoryId: 'cat-utilities', budgeted: 450 },
  { categoryId: 'cat-entertainment', budgeted: 300 },
];

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
