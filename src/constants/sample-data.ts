// TEMP-for-Stage-5 sample data — local mock content only, so screen layouts
// can be judged with realistic content before Stage 6 wires real Firestore
// state. Shapes are a simplified subset of docs/data-model.md's types (no
// lifecycle/audit/exchange-rate bookkeeping fields — those aren't relevant
// until later stages); replace with real data once Stage 6 lands.

export type SampleCategory = {
  id: string;
  name: string;
  type: 'expense' | 'income' | 'both';
  lifecycleState: 'active' | 'archived';
};

export const sampleCategories: SampleCategory[] = [
  { id: 'cat-rent', name: 'Rent', type: 'expense', lifecycleState: 'active' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', lifecycleState: 'active' },
  { id: 'cat-transport', name: 'Transport', type: 'expense', lifecycleState: 'active' },
  { id: 'cat-utilities', name: 'Utilities', type: 'expense', lifecycleState: 'active' },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense', lifecycleState: 'active' },
  { id: 'cat-salary', name: 'Salary', type: 'income', lifecycleState: 'active' },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', lifecycleState: 'active' },
];

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

export type SampleExpense = {
  id: string;
  name: string;
  categoryId: string;
  kind: 'oneTime' | 'recurringInstance';
  amount: number;
  currency: string;
  date: Date;
  paid: boolean;
};

export const sampleExpenses: SampleExpense[] = [
  {
    id: 'exp-1',
    name: 'Rent',
    categoryId: 'cat-rent',
    kind: 'recurringInstance',
    amount: 3500,
    currency: 'GTQ',
    date: new Date(2026, 6, 1),
    paid: true,
  },
  {
    id: 'exp-2',
    name: 'Electricity',
    categoryId: 'cat-utilities',
    kind: 'recurringInstance',
    amount: 512,
    currency: 'GTQ',
    date: new Date(2026, 6, 5),
    paid: true,
  },
  {
    id: 'exp-3',
    name: 'Internet',
    categoryId: 'cat-utilities',
    kind: 'recurringInstance',
    amount: 280,
    currency: 'GTQ',
    date: new Date(2026, 6, 15),
    paid: false,
  },
  {
    id: 'exp-4',
    name: 'Groceries',
    categoryId: 'cat-groceries',
    kind: 'oneTime',
    amount: 450,
    currency: 'GTQ',
    date: new Date(2026, 6, 3),
    paid: true,
  },
  {
    id: 'exp-5',
    name: 'Groceries',
    categoryId: 'cat-groceries',
    kind: 'oneTime',
    amount: 380,
    currency: 'GTQ',
    date: new Date(2026, 6, 12),
    paid: true,
  },
  {
    id: 'exp-6',
    name: 'Movie night',
    categoryId: 'cat-entertainment',
    kind: 'oneTime',
    amount: 120,
    currency: 'GTQ',
    date: new Date(2026, 6, 8),
    paid: true,
  },
  {
    id: 'exp-7',
    name: 'Bus pass',
    categoryId: 'cat-transport',
    kind: 'recurringInstance',
    amount: 420,
    currency: 'GTQ',
    date: new Date(2026, 6, 1),
    paid: true,
  },
];

export type SampleIncome = {
  id: string;
  name: string;
  categoryId: string;
  kind: 'oneTime' | 'recurringInstance';
  amount: number;
  currency: string;
  date: Date;
  paid: boolean;
};

export const sampleIncomes: SampleIncome[] = [
  {
    id: 'inc-1',
    name: 'Salary',
    categoryId: 'cat-salary',
    kind: 'recurringInstance',
    amount: 12000,
    currency: 'GTQ',
    date: new Date(2026, 6, 1),
    paid: true,
  },
  {
    id: 'inc-2',
    name: 'Freelance project',
    categoryId: 'cat-freelance',
    kind: 'oneTime',
    amount: 2480,
    currency: 'GTQ',
    date: new Date(2026, 6, 10),
    paid: true,
  },
  {
    id: 'inc-3',
    name: 'Freelance retainer',
    categoryId: 'cat-freelance',
    kind: 'recurringInstance',
    amount: 1500,
    currency: 'GTQ',
    date: new Date(2026, 6, 20),
    paid: false,
  },
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
