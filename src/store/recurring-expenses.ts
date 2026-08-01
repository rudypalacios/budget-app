import { createCollectionStore } from './create-collection-store';
import { archiveTransition, restoreTransition, trashTransition } from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { useUserSettingsStore } from './user-settings';
import type { ArchivableState, BudgetRecommendation, CurrencyCode, RecurringExpense } from '@/types/firestore';

const store = createCollectionStore<RecurringExpense>('recurringExpenses');

export const useRecurringExpensesStore = store.useStore;
export const subscribeRecurringExpenses = store.subscribe;

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

// FR-4a/4b/4e (data-model.md §7) — archiving/trashing a definition only
// flips its own lifecycleState; it never cascades to already-generated
// instances (separate documents, see expenses.ts's archiveExpense/
// trashExpense). recurring-generation.ts already scans only
// lifecycleState === 'active' definitions, so this stops future generation
// for free once one of these is called (FR-4e).
export function archiveRecurringExpense(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashRecurringExpense(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition) throw new Error(`recurringExpenses store: trashRecurringExpense(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(definition.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Engine-only for now (Stage 12) — no UI calls this yet, restore/purge get a
// real screen in Stage 17. Exercised by unit tests in the meantime.
export function restoreRecurringExpense(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition?.trashedFromState) {
    throw new Error(`recurringExpenses store: restoreRecurringExpense(${id}) — not currently trashed`);
  }
  return store.update(id, restoreTransition(definition.trashedFromState, definition.archivedAt));
}

export function purgeRecurringExpense(id: string) {
  return store.remove(id);
}
