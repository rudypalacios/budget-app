import { getCurrentCycleRange, isWithinCycle, type CycleRange } from './cycle';
import { robustAverage } from './estimate';
import type { ExpenseRecord, IncomeRecord } from '@/types/firestore';

// Pure budget-screen math (Presupuesto redesign §5) — kept separate from the
// screen so it's directly unit-testable, same split as lifecycle-transitions.ts
// and budget-recommendation.ts.

// D1: a budget of 0 (or blank, or non-numeric) means "no budget", identical
// to null — the app already treats null/blank that way, this just makes 0
// behave the same instead of rendering a permanently-over-budget category.
export function normalizeMonthlyBudget(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

// §5.1: the same filter budget.tsx's stillToPayThisMonth used inline before
// this refactor — extracted so it can also be applied per-category
// (pendingByCategory) without the two copies drifting apart (D2).
export function isPendingInCycle(expense: ExpenseRecord, cycleRange: CycleRange): boolean {
  return (
    !expense.paid &&
    !(expense.kind === 'recurringInstance' && expense.skipped) &&
    expense.lifecycleState === 'active' &&
    isWithinCycle(expense.date.toDate(), cycleRange)
  );
}

// The paid-side counterpart of isPendingInCycle: what counts as "spent this
// cycle" (keyed by paidDate — a bill settled today belongs to this cycle
// even if it was due months ago). Shared by actualByCategory, the summary's
// paid total and categoryMovements so all three always agree.
export function isPaidInCycle(expense: ExpenseRecord, cycleRange: CycleRange): boolean {
  return expense.paid && expense.lifecycleState === 'active' && isWithinCycle(expense.paidDate!.toDate(), cycleRange);
}

function sumByCategory(expenses: ExpenseRecord[], predicate: (expense: ExpenseRecord) => boolean): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!predicate(expense)) continue;
    totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountInDefaultCurrency);
  }
  return totals;
}

export function actualByCategory(expenses: ExpenseRecord[], cycleRange: CycleRange): Map<string, number> {
  return sumByCategory(expenses, (expense) => isPaidInCycle(expense, cycleRange));
}

export function pendingByCategory(expenses: ExpenseRecord[], cycleRange: CycleRange): Map<string, number> {
  return sumByCategory(expenses, (expense) => isPendingInCycle(expense, cycleRange));
}

export type CategoryMovements<T extends ExpenseRecord> = {
  pending: T[];
  paid: T[];
};

// D9: every expense behind a category card's figures this cycle — pending
// (sums to its `pending`) then paid (sums to its `actual`). Built from the
// same two predicates as those totals, so skipped/archived/trashed records
// are excluded here exactly as they are there. Pending by due date, paid by
// paid date, both oldest first.
export function categoryMovements<T extends ExpenseRecord>(
  expenses: T[],
  categoryId: string,
  cycleRange: CycleRange,
): CategoryMovements<T> {
  const inCategory = expenses.filter((expense) => expense.categoryId === categoryId);
  const pending = inCategory
    .filter((expense) => isPendingInCycle(expense, cycleRange))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
  const paid = inCategory
    .filter((expense) => isPaidInCycle(expense, cycleRange))
    .sort((a, b) => a.paidDate!.toMillis() - b.paidDate!.toMillis());
  return { pending, paid };
}

// Fixed look-back for the category budget suggestion — same 6-month window
// as the per-recurring rolling average (FR-6a), not user-configurable.
const SUGGESTION_WINDOW_MONTHS = 6;

// D10: a category's suggested monthly budget is what it costs in a normal
// month — every paid expense in it, one-time and recurring alike (a category
// budget covers everything filed under it). Built from monthly totals over
// the last 6 *complete* months (the current, unfinished one would drag it
// down), counting only months since the category's first paid expense so a
// young category isn't diluted by empty months before it existed. Outlier
// months (e.g. a one-off appliance purchase) are dropped with Tukey's IQR
// rule before averaging, while a category that's sporadic by nature (gifts:
// 0, 0, 500, 0, 1200…) keeps its real average — a plain median would say 0.
// null means no suggestion: no complete month of history, or nothing left
// to suggest (0).
export function suggestCategoryBudget(
  expenses: ExpenseRecord[],
  categoryId: string,
  referenceDate: Date = new Date(),
): number | null {
  const currentCycle = getCurrentCycleRange(referenceDate);
  const paidInCategory = expenses.filter(
    (expense) => expense.categoryId === categoryId && expense.paid && expense.lifecycleState === 'active',
  );

  const firstPaidMs = Math.min(...paidInCategory.map((expense) => expense.paidDate!.toMillis()));
  if (!Number.isFinite(firstPaidMs) || firstPaidMs >= currentCycle.start.getTime()) return null;

  const firstPaid = new Date(firstPaidMs);
  const monthsOfHistory =
    (currentCycle.start.getFullYear() - firstPaid.getFullYear()) * 12 + (currentCycle.start.getMonth() - firstPaid.getMonth());
  const months = Math.min(monthsOfHistory, SUGGESTION_WINDOW_MONTHS);

  // One total per complete month, oldest first; months with no spending
  // stay 0 (they're part of the pattern).
  const monthlyTotals = Array.from({ length: months }, (_, index) => {
    const cycle: CycleRange = {
      start: new Date(currentCycle.start.getFullYear(), currentCycle.start.getMonth() - months + index, 1),
      end: new Date(currentCycle.start.getFullYear(), currentCycle.start.getMonth() - months + index + 1, 1),
    };
    return paidInCategory
      .filter((expense) => isWithinCycle(expense.paidDate!.toDate(), cycle))
      .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  });

  // D12: the app's standard estimate (outlier months dropped, then averaged).
  const average = Math.round(robustAverage(monthlyTotals)! * 100) / 100;
  return average > 0 ? average : null;
}

export type BudgetStatus = 'none' | 'over' | 'mayExceed' | 'exact' | 'ok';

export type BudgetStatusInput = {
  budgeted: number | null; // already normalized — normalizeMonthlyBudget's output
  actual: number;
  pending: number;
};

// §5.2 — order of evaluation matters: "exactly at 100% but with something
// pending" is mayExceed, not exact.
export function getBudgetStatus({ budgeted, actual, pending }: BudgetStatusInput): BudgetStatus {
  if (budgeted === null) return 'none';
  if (actual > budgeted) return 'over';
  if (pending > 0 && actual + pending > budgeted) return 'mayExceed';
  if (Math.round(actual * 100) === Math.round(budgeted * 100)) return 'exact';
  return 'ok';
}

export function budgetPercent(budgeted: number | null, actual: number): number {
  return budgeted !== null && budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
}

export function projectedTotal(actual: number, pending: number): number {
  return actual + pending;
}

export type BudgetCategoryRow = {
  id: string;
  name: string;
  budgeted: number | null;
  actual: number;
  pending: number;
  status: BudgetStatus;
};

// 'none' never actually reaches this comparator in practice (splitByBudget
// filters it out before calling sortCategoryRows) — ranked here only so
// STATUS_RANK can be indexed by the full BudgetStatus type.
const STATUS_RANK: Record<BudgetStatus, number> = {
  over: 0,
  mayExceed: 1,
  exact: 2,
  ok: 2,
  none: -1,
};

// §5.4 "con presupuesto" order: over → mayExceed → exact/ok; within over,
// largest excess first; within the rest, largest unrounded ratio first;
// final tie-break is name (localeCompare, deterministic). Only meaningful
// for rows with a budget — see splitByBudget for the "sin presupuesto" list,
// which sorts differently.
export function sortCategoryRows(rows: BudgetCategoryRow[]): BudgetCategoryRow[] {
  return [...rows].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;

    if (a.status === 'over') {
      const excessDiff = b.actual - (b.budgeted ?? 0) - (a.actual - (a.budgeted ?? 0));
      if (excessDiff !== 0) return excessDiff;
    } else {
      const ratioA = a.budgeted && a.budgeted > 0 ? a.actual / a.budgeted : 0;
      const ratioB = b.budgeted && b.budgeted > 0 ? b.actual / b.budgeted : 0;
      if (ratioA !== ratioB) return ratioB - ratioA;
    }

    return a.name.localeCompare(b.name);
  });
}

// §5.4 — splits into "con presupuesto" (sorted by sortCategoryRows) and "sin
// presupuesto" (sorted by largest actual first, tie-break by name).
export function splitByBudget(rows: BudgetCategoryRow[]): {
  withBudget: BudgetCategoryRow[];
  withoutBudget: BudgetCategoryRow[];
} {
  const withBudget = sortCategoryRows(rows.filter((row) => row.status !== 'none'));
  const withoutBudget = [...rows.filter((row) => row.status === 'none')].sort(
    (a, b) => b.actual - a.actual || a.name.localeCompare(b.name),
  );
  return { withBudget, withoutBudget };
}

// §5.4 — attention count = categories that are over or could go over.
export function attentionCount(rows: BudgetCategoryRow[]): number {
  return rows.filter((row) => row.status === 'over' || row.status === 'mayExceed').length;
}

export type BudgetSummaryInput = {
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  cycleRange: CycleRange;
};

export type BudgetSummary = {
  received: number;
  paid: number;
  settled: number;
  stillToPay: number;
  incomePending: number;
  projected: number;
  overall: number;
};

// Same formulas as budget.tsx's summary card, extracted so they're testable
// against the prototype's dataset — see §4, these are not to be reinterpreted.
export function computeBudgetSummary({ expenses, incomes, cycleRange }: BudgetSummaryInput): BudgetSummary {
  const received = incomes
    .filter((income) => income.paid && income.lifecycleState === 'active' && isWithinCycle(income.paidDate!.toDate(), cycleRange))
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);

  const paid = expenses
    .filter((expense) => isPaidInCycle(expense, cycleRange))
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);

  const settled = received - paid;

  const stillToPay = expenses
    .filter((expense) => isPendingInCycle(expense, cycleRange))
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);

  const incomePending = incomes
    .filter(
      (income) =>
        !income.paid &&
        !(income.kind === 'recurringInstance' && income.skipped) &&
        income.lifecycleState === 'active' &&
        isWithinCycle(income.date.toDate(), cycleRange),
    )
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);

  const projected = settled + incomePending - stillToPay;

  const allTimeIncomeReceived = incomes
    .filter((income) => income.paid && income.lifecycleState === 'active')
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);
  const allTimeExpensesPaid = expenses
    .filter((expense) => expense.paid && expense.lifecycleState === 'active')
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  const overall = allTimeIncomeReceived - allTimeExpensesPaid;

  return { received, paid, settled, stillToPay, incomePending, projected, overall };
}
