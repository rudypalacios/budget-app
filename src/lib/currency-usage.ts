import type { WithId } from '@/lib/firebase/firestore.types';
import type { CurrencyCode, ExpenseRecord, IncomeRecord } from '@/types/firestore';

// How many still-open records are entered in `currency` — the ones whose
// estimate a rate change would affect (ajustes-v2 prototype's "Used in N
// pending records" on the Currencies screen). Paid records are left out
// because their amount and rate were fixed when they were paid (FR-16),
// skipped recurring instances because they'll never be paid, and
// archived/trashed records because they're out of every list.
export function countPendingRecordsInCurrency(
  currency: CurrencyCode,
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
): number {
  const pendingExpenses = expenses.filter(
    (expense) =>
      expense.currency === currency &&
      expense.lifecycleState === 'active' &&
      !expense.paid &&
      !(expense.kind === 'recurringInstance' && expense.skipped),
  );
  const pendingIncomes = incomes.filter(
    (income) => income.currency === currency && income.lifecycleState === 'active' && !income.paid,
  );
  return pendingExpenses.length + pendingIncomes.length;
}
