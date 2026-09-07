import { isWithinCycle, type CycleRange } from './cycle';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { ExpenseRecord, IncomeRecord } from '@/types/firestore';

// amount is only null for an unpaid RecurringExpenseInstance (data-model.md
// §6) — fall back to its budgetedAmount snapshot so callers always have a
// real number to display/prefill, whether or not the instance has been paid
// yet. Exported so expenses/[id]/edit.tsx's amount-prefill uses the exact
// same fallback as this dashboard, after a missed copy of this logic once
// left that screen prefilling "0" for an unpaid instance instead.
export function getExpenseAmount(expense: ExpenseRecord): number {
  return expense.amount ?? expense.budgetedAmount ?? 0;
}

export type PaymentDirection = 'expense' | 'income';

// Unified shape over ExpenseRecord/IncomeRecord, shared by this dashboard
// and history.tsx's ledger view — `skipped`/`skippedAt` are normalized to
// false/null for one-time records, which have no such field
// (data-model.md §12).
export type PaymentRow = {
  id: string;
  direction: PaymentDirection;
  kind: 'oneTime' | 'recurringInstance';
  name: string;
  categoryId: string;
  date: Date;
  amount: number;
  currency: string;
  amountInDefaultCurrency: number;
  paid: boolean;
  paidDate: Date | null;
  skipped: boolean;
  skippedAt: Date | null;
  // Stage 18 (FR-21, data-model.md §11) — grouping is expenses-only, so
  // this is always null on an income row.
  parentExpenseId: string | null;
};

export function buildPaymentRows(
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
): PaymentRow[] {
  // Archived/trashed records are hidden from every normal view (FR-4a) —
  // filtered here, upstream of the overdue/upcoming/completed grouping
  // below, so archive/delete removes a row the same way paying/skipping
  // moves it, without either group needing its own lifecycleState check.
  const activeExpenses = expenses.filter((expense) => expense.lifecycleState === 'active');
  const activeIncomes = incomes.filter((income) => income.lifecycleState === 'active');

  const expenseRows: PaymentRow[] = activeExpenses.map((expense) => ({
    id: expense.id,
    direction: 'expense',
    kind: expense.kind,
    name: expense.name,
    categoryId: expense.categoryId,
    date: expense.date.toDate(),
    amount: getExpenseAmount(expense),
    currency: expense.currency,
    amountInDefaultCurrency: expense.amountInDefaultCurrency,
    paid: expense.paid,
    paidDate: expense.paidDate ? expense.paidDate.toDate() : null,
    skipped: expense.kind === 'recurringInstance' ? expense.skipped : false,
    skippedAt:
      expense.kind === 'recurringInstance' && expense.skippedAt ? expense.skippedAt.toDate() : null,
    parentExpenseId: expense.parentExpenseId,
  }));

  const incomeRows: PaymentRow[] = activeIncomes.map((income) => ({
    id: income.id,
    direction: 'income',
    kind: income.kind,
    name: income.name,
    categoryId: income.categoryId,
    date: income.date.toDate(),
    amount: income.amount,
    currency: income.currency,
    amountInDefaultCurrency: income.amountInDefaultCurrency,
    paid: income.paid,
    paidDate: income.paidDate ? income.paidDate.toDate() : null,
    skipped: income.kind === 'recurringInstance' ? income.skipped : false,
    skippedAt: income.kind === 'recurringInstance' && income.skippedAt ? income.skippedAt.toDate() : null,
    parentExpenseId: null,
  }));

  return [...expenseRows, ...incomeRows];
}

export type PaymentRowGroups = {
  overdueUnpaid: PaymentRow[];
  upcomingUnpaid: PaymentRow[];
  completedThisCycle: PaymentRow[];
};

function actionTimestamp(row: PaymentRow): Date | null {
  return row.paid ? row.paidDate : row.skippedAt;
}

// Three groups, per data-model.md §12 — an unpaid row never ages out on
// its own; it only leaves groups 1-2 via paid/skipped (archive/delete
// remove it from the `expenses`/`incomes` listeners entirely, upstream of
// this function). Group 3 is keyed by the *action* timestamp (paidDate/
// skippedAt), never by `date` — a payment settled today for a 3-month-old
// bill belongs to *this* cycle, not the cycle it was originally due in.
export function groupPaymentRows(
  rows: PaymentRow[],
  cycleRange: CycleRange,
  referenceDate: Date = new Date(),
): PaymentRowGroups {
  // Compared at day granularity, not exact-instant: a bill due today
  // shouldn't flip to "overdue" as the clock ticks past midnight's exact
  // moment — it's overdue starting tomorrow if still unpaid.
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  const overdueUnpaid: PaymentRow[] = [];
  const upcomingUnpaid: PaymentRow[] = [];
  const completedThisCycle: PaymentRow[] = [];

  for (const row of rows) {
    if (!row.paid && !row.skipped) {
      if (row.date < startOfToday) {
        overdueUnpaid.push(row);
      } else {
        upcomingUnpaid.push(row);
      }
      continue;
    }

    const completedAt = actionTimestamp(row);
    if (completedAt && isWithinCycle(completedAt, cycleRange)) {
      completedThisCycle.push(row);
    }
  }

  overdueUnpaid.sort((a, b) => a.date.getTime() - b.date.getTime());
  upcomingUnpaid.sort((a, b) => a.date.getTime() - b.date.getTime());
  completedThisCycle.sort((a, b) => {
    const aTime = actionTimestamp(a)?.getTime() ?? 0;
    const bTime = actionTimestamp(b)?.getTime() ?? 0;
    return bTime - aTime;
  });

  return {
    overdueUnpaid: orderRowsWithGroupedChildren(overdueUnpaid),
    upcomingUnpaid: orderRowsWithGroupedChildren(upcomingUnpaid),
    completedThisCycle: orderRowsWithGroupedChildren(completedThisCycle),
  };
}

// Stage 18 (FR-21f, data-model.md §11/§13) — visually nests a group's
// children directly under their parent, Google-Keep-style, instead of
// leaving them wherever plain date/action-timestamp sort happened to put
// them. Applied *within* each already-sorted bucket, never across
// buckets: a child only moves next to its parent when both landed in the
// same bucket (e.g. both still unpaid-and-overdue, or both paid this
// cycle) — a child whose parent is unpaid while it's already paid (or vice
// versa) keeps its own natural sorted position in its own bucket, since
// there's no parent row present there to nest under. This mirrors how a
// Keep list's checked items move together as a group once the whole group
// is checked, but a lone checked sub-item without its parent doesn't drag
// the (still-unchecked) parent along with it.
export function orderRowsWithGroupedChildren(rows: PaymentRow[]): PaymentRow[] {
  const idsInThisBucket = new Set(rows.map((row) => row.id));
  const childrenByParentId = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    if (row.direction === 'expense' && row.parentExpenseId && idsInThisBucket.has(row.parentExpenseId)) {
      const siblings = childrenByParentId.get(row.parentExpenseId) ?? [];
      siblings.push(row);
      childrenByParentId.set(row.parentExpenseId, siblings);
    }
  }
  const consumedChildIds = new Set(Array.from(childrenByParentId.values()).flat().map((row) => row.id));

  const ordered: PaymentRow[] = [];
  for (const row of rows) {
    if (consumedChildIds.has(row.id)) continue; // placed right after its parent below instead
    ordered.push(row);
    const children = childrenByParentId.get(row.id);
    if (children) ordered.push(...children);
  }
  return ordered;
}
