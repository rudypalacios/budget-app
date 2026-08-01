import { createCollectionStore } from './create-collection-store';
import type { BudgetRecommendation, CurrencyCode, RecurringExpense, Timestamp } from '@/types/firestore';

const store = createCollectionStore<RecurringExpense>('recurringExpenses');

export const useRecurringExpensesStore = store.useStore;
export const subscribeRecurringExpenses = store.subscribe;

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in.
function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}

const EMPTY_BUDGET_RECOMMENDATION: BudgetRecommendation = {
  rollingAverageAmount: null,
  sampleSize: 0,
  computedAt: null,
  suggestedBudgetedAmount: null,
  status: 'none',
  dismissedAt: null,
  dismissedAtAverageAmount: null,
};

export type NewRecurringExpenseInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  dueDay: number;
  startDate: Date;
};

export function addRecurringExpense(input: NewRecurringExpenseInput) {
  const doc: Omit<RecurringExpense, 'createdAt' | 'updatedAt'> = {
    name: input.name,
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    dueDay: input.dueDay,
    startDate: toTimestamp(input.startDate),
    remindersEnabled: null,
    reminderLeadDays: null,
    budgetRecommendation: EMPTY_BUDGET_RECOMMENDATION,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.add(doc);
}

type EditableRecurringExpenseFields = Pick<
  RecurringExpense,
  'name' | 'categoryId' | 'amount' | 'currency' | 'exchangeRateToDefault' | 'dueDay' | 'startDate'
>;

export function updateRecurringExpense(id: string, patch: Partial<EditableRecurringExpenseFields>) {
  return store.update(id, patch);
}
