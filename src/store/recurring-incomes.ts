import { createCollectionStore } from './create-collection-store';
import { archiveTransition, restoreTransition, trashTransition } from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { trimName } from '@/lib/text-input';
import { useUserSettingsStore } from './user-settings';
import type {
  ArchivableState,
  CurrencyCode,
  RecurringIncome,
  RecurringIncomeFrequency,
  Timestamp,
} from '@/types/firestore';

const store = createCollectionStore<RecurringIncome>('recurringIncomes');

// Narrowed shape restoreTransition (lifecycle-transitions.ts) needs — see
// restoreRecurringIncome below, same cast rationale as expenses.ts's
// ArchivedOrTrashedRecord.
type ArchivedOrTrashedRecord = {
  lifecycleState: 'archived' | 'trashed';
  trashedFromState: ArchivableState | null;
  archivedAt: Timestamp | null;
};

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
  return store.update(id, patch.name !== undefined ? { ...patch, name: trimName(patch.name) } : patch);
}

// FR-4a/4b/4e (data-model.md §7) — see the matching comment on
// archiveRecurringExpense/trashRecurringExpense in recurring-expenses.ts.
export function archiveRecurringIncome(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashRecurringIncome(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition) throw new Error(`recurringIncomes store: trashRecurringIncome(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(definition.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Engine-only for now (Stage 12) — no UI calls this yet, restore/purge get a
// real screen in Stage 17. Exercised by unit tests in the meantime.
//
// Restores either a trashed or a merely-archived record — see
// lifecycle-transitions.ts's restoreTransition comment for the bug this
// fixed (previously only the trashed case worked; restoring straight from
// Archive threw for every recurring income definition).
export function restoreRecurringIncome(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition || definition.lifecycleState === 'active') {
    throw new Error(`recurringIncomes store: restoreRecurringIncome(${id}) — not currently archived or trashed`);
  }
  return store.update(id, restoreTransition(definition as ArchivedOrTrashedRecord));
}

export function purgeRecurringIncome(id: string) {
  return store.remove(id);
}
