import { isWithinCycle, type CycleRange } from './cycle';
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

function sumByCategory(expenses: ExpenseRecord[], predicate: (expense: ExpenseRecord) => boolean): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!predicate(expense)) continue;
    totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountInDefaultCurrency);
  }
  return totals;
}

export function actualByCategory(expenses: ExpenseRecord[], cycleRange: CycleRange): Map<string, number> {
  return sumByCategory(
    expenses,
    (expense) => expense.paid && expense.lifecycleState === 'active' && isWithinCycle(expense.paidDate!.toDate(), cycleRange),
  );
}

export function pendingByCategory(expenses: ExpenseRecord[], cycleRange: CycleRange): Map<string, number> {
  return sumByCategory(expenses, (expense) => isPendingInCycle(expense, cycleRange));
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
    .filter((expense) => expense.paid && expense.lifecycleState === 'active' && isWithinCycle(expense.paidDate!.toDate(), cycleRange))
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
