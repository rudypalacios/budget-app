import { createCollectionStore } from './create-collection-store';
import type { CurrencyCode, RecurringIncome, RecurringIncomeFrequency, Timestamp } from '@/types/firestore';

const store = createCollectionStore<RecurringIncome>('recurringIncomes');

export const useRecurringIncomesStore = store.useStore;
export const subscribeRecurringIncomes = store.subscribe;

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in.
function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}

export type NewRecurringIncomeInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  startDate: Date;
  frequency: RecurringIncomeFrequency;
  dayOfMonth: number | null;
  anchorDate: Date | null;
};

// No screen creates these yet (data-model.md §9's generation-on-launch
// logic and a management UI aren't built — see CLAUDE.md Known Issues); this
// is the state-layer primitive Stage 6 called for so that work can plug in
// without also having to build the store layer at that point.
export function addRecurringIncome(input: NewRecurringIncomeInput) {
  const doc: Omit<RecurringIncome, 'createdAt' | 'updatedAt'> = {
    name: input.name,
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency,
    exchangeRateToDefault: 1, // no multi-currency yet — Stage 10
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
  return store.update(id, patch);
}
