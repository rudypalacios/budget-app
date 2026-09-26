import { createCollectionStore } from './create-collection-store';
import {
  archiveTransition,
  restoreTransition,
  trashTransition,
  unarchiveTransition,
} from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { trimName } from '@/lib/text-input';
import { useUserSettingsStore } from './user-settings';
import type {
  ArchivableState,
  CurrencyCode,
  RecurringIncome,
  RecurringIncomeFrequency,
} from '@/types/firestore';

const store = createCollectionStore<RecurringIncome>('recurringIncomes');

export const useRecurringIncomesStore = store.useStore;
export const subscribeRecurringIncomes = store.subscribe;

export type NewRecurringIncomeInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  startDate: Date;
  frequency: RecurringIncomeFrequency;
  dayOfMonth: number | null;
  anchorDate: Date | null;
};

export function addRecurringIncome(input: NewRecurringIncomeInput) {
  const doc: Omit<RecurringIncome, 'createdAt' | 'updatedAt'> = {
    name: trimName(input.name),
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    startDate: toTimestamp(input.startDate),
    frequency: input.frequency,
    dayOfMonth: input.dayOfMonth,
    anchorDate: input.anchorDate ? toTimestamp(input.anchorDate) : null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.add(doc);
}

type EditableRecurringIncomeFields = Pick<
  RecurringIncome,
  | 'name'
  | 'categoryId'
  | 'amount'
  | 'currency'
  | 'exchangeRateToDefault'
  | 'startDate'
  | 'frequency'
  | 'dayOfMonth'
  | 'anchorDate'
>;

export function updateRecurringIncome(id: string, patch: Partial<EditableRecurringIncomeFields>) {
  return store.update(
    id,
    patch.name !== undefined ? { ...patch, name: trimName(patch.name) } : patch,
  );
}

// FR-4a/4b/4e (data-model.md §7) — see the matching comment on
// archiveRecurringExpense/trashRecurringExpense in recurring-expenses.ts.
export function archiveRecurringIncome(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashRecurringIncome(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition)
    throw new Error(`recurringIncomes store: trashRecurringIncome(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(definition.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Archive screen's Restore for an archived (never trashed) record — see
// unarchiveTransition.
export function unarchiveRecurringIncome(id: string) {
  return store.update(id, unarchiveTransition());
}

// Engine-only for now (Stage 12) — no UI calls this yet, restore/purge get a
// real screen in Stage 17. Exercised by unit tests in the meantime.
export function restoreRecurringIncome(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition?.trashedFromState) {
    throw new Error(
      `recurringIncomes store: restoreRecurringIncome(${id}) — not currently trashed`,
    );
  }
  return store.update(id, restoreTransition(definition.trashedFromState, definition.archivedAt));
}

export function purgeRecurringIncome(id: string) {
  return store.remove(id);
}
