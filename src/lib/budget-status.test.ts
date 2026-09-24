import {
  actualByCategory,
  attentionCount,
  budgetPercent,
  computeBudgetSummary,
  getBudgetStatus,
  isPendingInCycle,
  normalizeMonthlyBudget,
  pendingByCategory,
  projectedTotal,
  splitByBudget,
  type BudgetCategoryRow,
} from './budget-status';
import { getCurrentCycleRange } from './cycle';
import type { WithId } from '@/lib/firebase/firestore.types';
import type {
  ExpenseRecord,
  IncomeRecord,
  OneTimeExpense,
  OneTimeIncome,
  RecurringExpenseInstance,
  RecurringIncomeInstance,
  Timestamp,
} from '@/types/firestore';

// Same conventions as payments-dashboard.test.ts's fixtures.
function fakeTimestamp(date: Date): Timestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

// Reference date fixes the cycle to July 2026 so in-cycle vs. out-of-cycle
// fixtures below are unambiguous.
const REFERENCE_DATE = new Date(2026, 6, 15);
const IN_CYCLE_DATE = new Date(2026, 6, 10);
const PREVIOUS_CYCLE_DATE = new Date(2026, 5, 10);
const CYCLE_RANGE = getCurrentCycleRange(REFERENCE_DATE);

function oneTimeExpense(overrides: Partial<WithId<OneTimeExpense>> = {}): WithId<OneTimeExpense> {
  return {
    id: 'exp-1',
    kind: 'oneTime',
    recurringExpenseId: null,
    name: 'Expense',
    categoryId: 'cat-1',
    date: fakeTimestamp(IN_CYCLE_DATE),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 0,
    rateSource: 'manual',
    budgetedAmount: null,
    budgetedCurrency: null,
    amount: 0,
    paid: false,
    paidDate: null,
    recurringGroupId: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(IN_CYCLE_DATE),
    updatedAt: fakeTimestamp(IN_CYCLE_DATE),
    ...overrides,
  };
}

function recurringExpenseInstance(
  overrides: Partial<WithId<RecurringExpenseInstance>> = {},
): WithId<RecurringExpenseInstance> {
  return {
    id: 'rexp-1_2026-07',
    kind: 'recurringInstance',
    recurringExpenseId: 'rexp-1',
    name: 'Recurring expense',
    categoryId: 'cat-1',
    date: fakeTimestamp(IN_CYCLE_DATE),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 0,
    rateSource: 'manual',
    budgetedAmount: 0,
    budgetedCurrency: 'GTQ',
    amount: null,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    recurringGroupId: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(IN_CYCLE_DATE),
    updatedAt: fakeTimestamp(IN_CYCLE_DATE),
    ...overrides,
  };
}

function oneTimeIncome(overrides: Partial<WithId<OneTimeIncome>> = {}): WithId<OneTimeIncome> {
  return {
    id: 'inc-1',
    kind: 'oneTime',
    recurringIncomeId: null,
    name: 'Income',
    categoryId: 'cat-income',
    date: fakeTimestamp(IN_CYCLE_DATE),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 0,
    rateSource: 'manual',
    amount: 0,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(IN_CYCLE_DATE),
    updatedAt: fakeTimestamp(IN_CYCLE_DATE),
    ...overrides,
  };
}

function recurringIncomeInstance(
  overrides: Partial<WithId<RecurringIncomeInstance>> = {},
): WithId<RecurringIncomeInstance> {
  return {
    id: 'rinc-1_2026-07',
    kind: 'recurringInstance',
    recurringIncomeId: 'rinc-1',
    name: 'Recurring income',
    categoryId: 'cat-income',
    date: fakeTimestamp(IN_CYCLE_DATE),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 0,
    rateSource: 'manual',
    amount: 0,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(IN_CYCLE_DATE),
    updatedAt: fakeTimestamp(IN_CYCLE_DATE),
    ...overrides,
  };
}

// Dataset from 01-presupuesto.md §11 / presupuesto-v9.html's DATA array —
// the shared source of truth for every test below.
const DATASET = [
  { id: 'viv', name: 'Vivienda', budgeted: 7500, actual: 7077.05, pending: 0, status: 'ok' as const },
  { id: 'deu', name: 'Deudas', budgeted: 14000, actual: 13104.6, pending: 0, status: 'ok' as const },
  { id: 'pre', name: 'Préstamos', budgeted: 3900, actual: 3900, pending: 0, status: 'exact' as const },
  { id: 'ali', name: 'Alimentación', budgeted: 3000, actual: 3184.85, pending: 0, status: 'over' as const },
  { id: 'fam', name: 'Familia', budgeted: null, actual: 1500, pending: 0, status: 'none' as const },
  { id: 'ser', name: 'Servicios', budgeted: 1200, actual: 550, pending: 335, status: 'ok' as const },
  { id: 'oci', name: 'Ocio', budgeted: 500, actual: 420, pending: 150, status: 'mayExceed' as const },
  { id: 'pro', name: 'Programación', budgeted: 300, actual: 0, pending: 107.85, status: 'ok' as const },
  { id: 'tra', name: 'Transporte', budgeted: 800, actual: 0, pending: 0, status: 'ok' as const },
];

function datasetRows(): BudgetCategoryRow[] {
  return DATASET.map(({ id, name, budgeted, actual, pending }) => ({
    id,
    name,
    budgeted,
    actual,
    pending,
    status: getBudgetStatus({ budgeted, actual, pending }),
  }));
}

describe('normalizeMonthlyBudget', () => {
  it.each([
    [null, null],
    [undefined, null],
    [0, null],
    [-5, null],
    [NaN, null],
    ['x', null],
    [3000, 3000],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeMonthlyBudget(input)).toBe(expected);
  });
});

describe('getBudgetStatus', () => {
  it.each(DATASET)('$name → $status', ({ budgeted, actual, pending, status }) => {
    expect(getBudgetStatus({ budgeted, actual, pending })).toBe(status);
  });

  it('is mayExceed, not exact, when actual equals budgeted but something is still pending', () => {
    expect(getBudgetStatus({ budgeted: 100, actual: 100, pending: 1 })).toBe('mayExceed');
  });

  it('is exact when actual equals budgeted and nothing is pending', () => {
    expect(getBudgetStatus({ budgeted: 100, actual: 100, pending: 0 })).toBe('exact');
  });

  it('treats a sub-cent rounding difference as exact', () => {
    expect(getBudgetStatus({ budgeted: 100, actual: 99.999, pending: 0 })).toBe('exact');
  });
});

describe('budgetPercent / projectedTotal', () => {
  it('rounds actual/budgeted to a percent', () => {
    expect(budgetPercent(1200, 550)).toBe(46);
    expect(budgetPercent(500, 420)).toBe(84);
  });

  it('is 0 when there is no budget', () => {
    expect(budgetPercent(null, 100)).toBe(0);
  });

  it('sums actual and pending', () => {
    expect(projectedTotal(550, 335)).toBe(885);
    expect(projectedTotal(0, 0)).toBe(0);
  });
});

describe('sortCategoryRows / splitByBudget / attentionCount', () => {
  it('splits into con/sin presupuesto and orders each per §5.4', () => {
    const { withBudget, withoutBudget } = splitByBudget(datasetRows());

    expect(withBudget.map((row) => row.id)).toEqual(['ali', 'oci', 'pre', 'viv', 'deu', 'ser', 'pro', 'tra']);
    expect(withoutBudget.map((row) => row.id)).toEqual(['fam']);
  });

  it('counts over + mayExceed as needing attention', () => {
    expect(attentionCount(datasetRows())).toBe(2);
  });

  it('breaks ties within "over" by largest excess first', () => {
    const rows: BudgetCategoryRow[] = [
      { id: 'a', name: 'A', budgeted: 100, actual: 110, pending: 0, status: 'over' },
      { id: 'b', name: 'B', budgeted: 100, actual: 150, pending: 0, status: 'over' },
    ];
    expect(splitByBudget(rows).withBudget.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('breaks a ratio tie by name (deterministic)', () => {
    const rows: BudgetCategoryRow[] = [
      { id: 'z', name: 'Zeta', budgeted: 100, actual: 50, pending: 0, status: 'ok' },
      { id: 'a', name: 'Alfa', budgeted: 200, actual: 100, pending: 0, status: 'ok' },
    ];
    expect(splitByBudget(rows).withBudget.map((row) => row.id)).toEqual(['a', 'z']);
  });

  it('orders "sin presupuesto" by largest actual first, tie-break by name', () => {
    const rows: BudgetCategoryRow[] = [
      { id: 'a', name: 'Zeta', budgeted: null, actual: 100, pending: 0, status: 'none' },
      { id: 'b', name: 'Alfa', budgeted: null, actual: 100, pending: 0, status: 'none' },
      { id: 'c', name: 'Beta', budgeted: null, actual: 200, pending: 0, status: 'none' },
    ];
    expect(splitByBudget(rows).withoutBudget.map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('isPendingInCycle', () => {
  it('is true for an unpaid, non-skipped, active expense due this cycle', () => {
    expect(isPendingInCycle(oneTimeExpense({ paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }), CYCLE_RANGE)).toBe(true);
  });

  it('is false once paid', () => {
    expect(isPendingInCycle(oneTimeExpense({ paid: true, date: fakeTimestamp(IN_CYCLE_DATE) }), CYCLE_RANGE)).toBe(false);
  });

  it('is false for a skipped recurring instance', () => {
    const expense = recurringExpenseInstance({ paid: false, skipped: true, date: fakeTimestamp(IN_CYCLE_DATE) });
    expect(isPendingInCycle(expense, CYCLE_RANGE)).toBe(false);
  });

  it('is false for an archived or trashed expense', () => {
    expect(
      isPendingInCycle(oneTimeExpense({ paid: false, lifecycleState: 'archived', date: fakeTimestamp(IN_CYCLE_DATE) }), CYCLE_RANGE),
    ).toBe(false);
  });

  it('is false when the due date falls outside the cycle', () => {
    expect(isPendingInCycle(oneTimeExpense({ paid: false, date: fakeTimestamp(PREVIOUS_CYCLE_DATE) }), CYCLE_RANGE)).toBe(false);
  });
});

describe('actualByCategory / pendingByCategory', () => {
  const expenses: ExpenseRecord[] = [
    oneTimeExpense({ id: 'e-viv', categoryId: 'viv', amountInDefaultCurrency: 7077.05, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-deu', categoryId: 'deu', amountInDefaultCurrency: 13104.6, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-ser-paid', categoryId: 'ser', amountInDefaultCurrency: 550, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-ser-pending', categoryId: 'ser', amountInDefaultCurrency: 335, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-pro-pending', categoryId: 'pro', amountInDefaultCurrency: 107.85, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    // Edge cases — none of these should count:
    oneTimeExpense({
      id: 'e-viv-archived',
      categoryId: 'viv',
      amountInDefaultCurrency: 999,
      paid: true,
      paidDate: fakeTimestamp(IN_CYCLE_DATE),
      lifecycleState: 'archived',
    }),
    oneTimeExpense({
      id: 'e-viv-lastmonth',
      categoryId: 'viv',
      amountInDefaultCurrency: 26084.5,
      paid: true,
      paidDate: fakeTimestamp(PREVIOUS_CYCLE_DATE),
    }),
    recurringExpenseInstance({
      id: 'e-ser-skipped',
      categoryId: 'ser',
      amountInDefaultCurrency: 999,
      paid: false,
      skipped: true,
      date: fakeTimestamp(IN_CYCLE_DATE),
    }),
  ];

  it('sums actual (paid, active, in-cycle) per category, excluding archived/out-of-cycle', () => {
    const totals = actualByCategory(expenses, CYCLE_RANGE);
    expect(totals.get('viv')).toBe(7077.05);
    expect(totals.get('deu')).toBe(13104.6);
    expect(totals.get('ser')).toBe(550);
    expect(totals.has('pro')).toBe(false);
  });

  it('sums pending (unpaid, non-skipped, active, in-cycle) per category, excluding skipped', () => {
    const totals = pendingByCategory(expenses, CYCLE_RANGE);
    expect(totals.get('ser')).toBe(335);
    expect(totals.get('pro')).toBe(107.85);
    expect(totals.has('viv')).toBe(false);
  });
});

describe('computeBudgetSummary', () => {
  const expenses: ExpenseRecord[] = [
    oneTimeExpense({ id: 'e-viv', categoryId: 'viv', amountInDefaultCurrency: 7077.05, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-deu', categoryId: 'deu', amountInDefaultCurrency: 13104.6, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-pre', categoryId: 'pre', amountInDefaultCurrency: 3900, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-ali', categoryId: 'ali', amountInDefaultCurrency: 3184.85, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-fam', categoryId: 'fam', amountInDefaultCurrency: 1500, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-ser', categoryId: 'ser', amountInDefaultCurrency: 550, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-oci', categoryId: 'oci', amountInDefaultCurrency: 420, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-ser-pending', categoryId: 'ser', amountInDefaultCurrency: 335, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-oci-pending', categoryId: 'oci', amountInDefaultCurrency: 150, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeExpense({ id: 'e-pro-pending', categoryId: 'pro', amountInDefaultCurrency: 107.85, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    // Paid last cycle — counts toward the all-time total only.
    oneTimeExpense({ id: 'e-old', categoryId: 'viv', amountInDefaultCurrency: 26084.5, paid: true, paidDate: fakeTimestamp(PREVIOUS_CYCLE_DATE) }),
    // Archived — excluded everywhere, including the all-time total.
    oneTimeExpense({
      id: 'e-archived',
      categoryId: 'viv',
      amountInDefaultCurrency: 999,
      paid: true,
      paidDate: fakeTimestamp(IN_CYCLE_DATE),
      lifecycleState: 'archived',
    }),
  ];

  const incomes: IncomeRecord[] = [
    oneTimeIncome({ id: 'i-received', amountInDefaultCurrency: 20974.67, paid: true, paidDate: fakeTimestamp(IN_CYCLE_DATE) }),
    oneTimeIncome({ id: 'i-pending', amountInDefaultCurrency: 6755.48, paid: false, date: fakeTimestamp(IN_CYCLE_DATE) }),
    // Received last cycle — counts toward the all-time total only.
    oneTimeIncome({ id: 'i-old', amountInDefaultCurrency: 20345.44, paid: true, paidDate: fakeTimestamp(PREVIOUS_CYCLE_DATE) }),
    // Skipped recurring income — excluded from both received and pending.
    recurringIncomeInstance({
      id: 'i-skipped',
      amountInDefaultCurrency: 999,
      paid: false,
      skipped: true,
      date: fakeTimestamp(IN_CYCLE_DATE),
    }),
  ];

  it('matches the prototype dataset exactly (§11)', () => {
    const summary = computeBudgetSummary({ expenses, incomes, cycleRange: CYCLE_RANGE });
    // toBeCloseTo, not toEqual — these are plain floating-point sums with no
    // rounding step (matching budget.tsx's pre-refactor behavior exactly),
    // so binary rounding noise in the last decimal is expected, not a bug.
    expect(summary.received).toBeCloseTo(20974.67, 2);
    expect(summary.paid).toBeCloseTo(29736.5, 2);
    expect(summary.settled).toBeCloseTo(-8761.83, 2);
    expect(summary.stillToPay).toBeCloseTo(592.85, 2);
    expect(summary.incomePending).toBeCloseTo(6755.48, 2);
    expect(summary.projected).toBeCloseTo(-2599.2, 2);
    expect(summary.overall).toBeCloseTo(-14500.89, 2);
  });

  it('stillToPay matches the pre-refactor stillToPayThisMonth filter exactly', () => {
    // The literal filter budget.tsx used before isPendingInCycle was
    // extracted (§5.1/D2) — kept here so a future change to isPendingInCycle
    // that silently changes behavior fails this test.
    const preRefactorStillToPay = expenses
      .filter(
        (expense) =>
          !expense.paid &&
          !(expense.kind === 'recurringInstance' && expense.skipped) &&
          expense.lifecycleState === 'active' &&
          expense.date.toDate() >= CYCLE_RANGE.start &&
          expense.date.toDate() < CYCLE_RANGE.end,
      )
      .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);

    expect(computeBudgetSummary({ expenses, incomes, cycleRange: CYCLE_RANGE }).stillToPay).toBe(preRefactorStillToPay);
  });
});
