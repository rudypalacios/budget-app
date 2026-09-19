import { getCurrentCycleRange } from './cycle';
import { buildPaymentRows, groupPaymentRows } from './payments-dashboard';
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

function fakeTimestamp(date: Date): Timestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

function oneTimeExpense(overrides: Partial<WithId<OneTimeExpense>> = {}): WithId<OneTimeExpense> {
  return {
    id: 'exp-1',
    kind: 'oneTime',
    recurringExpenseId: null,
    name: 'Groceries',
    categoryId: 'cat-1',
    date: fakeTimestamp(new Date(2026, 6, 1)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 100,
    rateSource: 'manual',
    budgetedAmount: null,
    budgetedCurrency: null,
    amount: 100,
    paid: false,
    paidDate: null,
    recurringGroupId: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 6, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 1)),
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
    name: 'Rent',
    categoryId: 'cat-2',
    date: fakeTimestamp(new Date(2026, 6, 5)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 2000,
    rateSource: 'manual',
    budgetedAmount: 2000,
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
    createdAt: fakeTimestamp(new Date(2026, 6, 5)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 5)),
    ...overrides,
  };
}

function oneTimeIncome(overrides: Partial<WithId<OneTimeIncome>> = {}): WithId<OneTimeIncome> {
  return {
    id: 'inc-1',
    kind: 'oneTime',
    recurringIncomeId: null,
    name: 'Freelance payment',
    categoryId: 'cat-3',
    date: fakeTimestamp(new Date(2026, 6, 1)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 500,
    rateSource: 'manual',
    amount: 500,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 6, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 1)),
    ...overrides,
  };
}

function recurringIncomeInstance(
  overrides: Partial<WithId<RecurringIncomeInstance>> = {},
): WithId<RecurringIncomeInstance> {
  return {
    id: 'rinc-1_2026-07-01',
    kind: 'recurringInstance',
    recurringIncomeId: 'rinc-1',
    name: 'Salary',
    categoryId: 'cat-4',
    date: fakeTimestamp(new Date(2026, 6, 1)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 5000,
    rateSource: 'manual',
    amount: 5000,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 6, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 1)),
    ...overrides,
  };
}

describe('buildPaymentRows', () => {
  it('merges expenses and incomes into one tagged, unduplicated list', () => {
    const rows = buildPaymentRows([oneTimeExpense()], [oneTimeIncome()]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.direction).sort()).toEqual(['expense', 'income']);
  });

  it('falls back to budgetedAmount when a recurring expense instance is unpaid (amount null)', () => {
    const rows = buildPaymentRows(
      [recurringExpenseInstance({ amount: null, budgetedAmount: 2000 })],
      [],
    );
    expect(rows[0].amount).toBe(2000);
  });

  it('normalizes skipped to false for one-time records', () => {
    const rows = buildPaymentRows([oneTimeExpense()], [oneTimeIncome()]);
    expect(rows.every((r) => r.skipped === false && r.skippedAt === null)).toBe(true);
  });

  it('carries skipped/skippedAt through for recurring expense instances', () => {
    const skippedAt = new Date(2026, 6, 10);
    const rows = buildPaymentRows(
      [recurringExpenseInstance({ skipped: true, skippedAt: fakeTimestamp(skippedAt) })],
      [],
    );
    expect(rows[0].skipped).toBe(true);
    expect(rows[0].skippedAt).toEqual(skippedAt);
  });

  it('carries skipped/skippedAt through for recurring income instances', () => {
    const skippedAt = new Date(2026, 6, 10);
    const rows = buildPaymentRows(
      [],
      [recurringIncomeInstance({ skipped: true, skippedAt: fakeTimestamp(skippedAt) })],
    );
    expect(rows[0].skipped).toBe(true);
    expect(rows[0].skippedAt).toEqual(skippedAt);
  });

  it('excludes archived and trashed records (FR-4a — hidden from every normal view)', () => {
    const rows = buildPaymentRows(
      [
        oneTimeExpense({ id: 'archived', lifecycleState: 'archived' }),
        oneTimeExpense({ id: 'trashed', lifecycleState: 'trashed' }),
      ],
      [oneTimeIncome({ id: 'archived-income', lifecycleState: 'archived' })],
    );
    expect(rows).toHaveLength(0);
  });

  it('produces exactly one row per input document, never duplicated', () => {
    const expenses: WithId<ExpenseRecord>[] = [
      oneTimeExpense({ id: 'a' }),
      recurringExpenseInstance({ id: 'b' }),
    ];
    const incomes: WithId<IncomeRecord>[] = [oneTimeIncome({ id: 'c' })];
    const rows = buildPaymentRows(expenses, incomes);
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('groupPaymentRows', () => {
  const referenceDate = new Date(2026, 6, 15); // Jul 15, 2026
  const cycleRange = getCurrentCycleRange(referenceDate);

  it('puts an unpaid item due in the past into Overdue, ascending oldest-first', () => {
    const rows = buildPaymentRows(
      [
        oneTimeExpense({ id: 'a', date: fakeTimestamp(new Date(2026, 6, 10)) }),
        oneTimeExpense({ id: 'b', date: fakeTimestamp(new Date(2026, 6, 5)) }),
      ],
      [],
    );
    const { overdueUnpaid } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(overdueUnpaid.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('keeps an unpaid item from 3 cycles ago in Overdue — it never ages out on its own', () => {
    const threeCyclesAgo = new Date(2026, 3, 5); // April, reference is July
    const rows = buildPaymentRows(
      [recurringExpenseInstance({ id: 'old', date: fakeTimestamp(threeCyclesAgo), paid: false })],
      [],
    );
    const { overdueUnpaid } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(overdueUnpaid.map((r) => r.id)).toEqual(['old']);
  });

  it('treats a bill due today as Upcoming, not Overdue', () => {
    const rows = buildPaymentRows(
      [oneTimeExpense({ id: 'today', date: fakeTimestamp(new Date(2026, 6, 15, 9, 0)) })],
      [],
    );
    const { overdueUnpaid, upcomingUnpaid } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(overdueUnpaid).toHaveLength(0);
    expect(upcomingUnpaid.map((r) => r.id)).toEqual(['today']);
  });

  it('sorts Upcoming ascending, soonest first', () => {
    const rows = buildPaymentRows(
      [
        oneTimeExpense({ id: 'later', date: fakeTimestamp(new Date(2026, 6, 25)) }),
        oneTimeExpense({ id: 'sooner', date: fakeTimestamp(new Date(2026, 6, 20)) }),
      ],
      [],
    );
    const { upcomingUnpaid } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(upcomingUnpaid.map((r) => r.id)).toEqual(['sooner', 'later']);
  });

  it('lands a payment made today for a 3-month-old overdue item in Completed this cycle, keyed by paidDate not date', () => {
    const oldDueDate = new Date(2026, 3, 5); // April
    const paidToday = new Date(2026, 6, 15); // July (this cycle)
    const rows = buildPaymentRows(
      [
        recurringExpenseInstance({
          id: 'late-payment',
          date: fakeTimestamp(oldDueDate),
          paid: true,
          paidDate: fakeTimestamp(paidToday),
        }),
      ],
      [],
    );
    const { overdueUnpaid, completedThisCycle } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(overdueUnpaid).toHaveLength(0);
    expect(completedThisCycle.map((r) => r.id)).toEqual(['late-payment']);
  });

  it('excludes a paid item whose paidDate falls in a previous cycle', () => {
    const paidLastMonth = new Date(2026, 5, 20); // June, reference cycle is July
    const rows = buildPaymentRows(
      [
        oneTimeExpense({
          id: 'old-paid',
          paid: true,
          paidDate: fakeTimestamp(paidLastMonth),
        }),
      ],
      [],
    );
    const { overdueUnpaid, upcomingUnpaid, completedThisCycle } = groupPaymentRows(
      rows,
      cycleRange,
      referenceDate,
    );
    expect(completedThisCycle).toHaveLength(0);
    expect(overdueUnpaid).toHaveLength(0);
    expect(upcomingUnpaid).toHaveLength(0);
  });

  it('includes a skipped item whose skippedAt falls in the current cycle', () => {
    const rows = buildPaymentRows(
      [
        recurringExpenseInstance({
          id: 'skipped-this-cycle',
          skipped: true,
          skippedAt: fakeTimestamp(new Date(2026, 6, 12)),
        }),
      ],
      [],
    );
    const { completedThisCycle } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(completedThisCycle.map((r) => r.id)).toEqual(['skipped-this-cycle']);
  });

  it('excludes a skipped item from a previous cycle from every group (rolled off, not re-surfaced as unpaid)', () => {
    const rows = buildPaymentRows(
      [
        recurringExpenseInstance({
          id: 'skipped-last-cycle',
          skipped: true,
          skippedAt: fakeTimestamp(new Date(2026, 5, 20)),
        }),
      ],
      [],
    );
    const { overdueUnpaid, upcomingUnpaid, completedThisCycle } = groupPaymentRows(
      rows,
      cycleRange,
      referenceDate,
    );
    expect(overdueUnpaid).toHaveLength(0);
    expect(upcomingUnpaid).toHaveLength(0);
    expect(completedThisCycle).toHaveLength(0);
  });

  it('sorts Completed this cycle descending by action timestamp, most recent first', () => {
    const rows = buildPaymentRows(
      [
        oneTimeExpense({
          id: 'earlier-paid',
          paid: true,
          paidDate: fakeTimestamp(new Date(2026, 6, 5)),
        }),
        oneTimeExpense({
          id: 'later-paid',
          paid: true,
          paidDate: fakeTimestamp(new Date(2026, 6, 12)),
        }),
      ],
      [],
    );
    const { completedThisCycle } = groupPaymentRows(rows, cycleRange, referenceDate);
    expect(completedThisCycle.map((r) => r.id)).toEqual(['later-paid', 'earlier-paid']);
  });

  it('never duplicates a row across groups', () => {
    const rows = buildPaymentRows(
      [
        oneTimeExpense({ id: 'overdue-1', date: fakeTimestamp(new Date(2026, 6, 1)) }),
        oneTimeExpense({
          id: 'paid-1',
          paid: true,
          paidDate: fakeTimestamp(new Date(2026, 6, 10)),
        }),
      ],
      [oneTimeIncome({ id: 'upcoming-1', date: fakeTimestamp(new Date(2026, 6, 20)) })],
    );
    const { overdueUnpaid, upcomingUnpaid, completedThisCycle } = groupPaymentRows(
      rows,
      cycleRange,
      referenceDate,
    );
    const allIds = [...overdueUnpaid, ...upcomingUnpaid, ...completedThisCycle].map((r) => r.id);
    expect(allIds.sort()).toEqual(['overdue-1', 'paid-1', 'upcoming-1']);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
