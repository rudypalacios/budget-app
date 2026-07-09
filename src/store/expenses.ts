import { createCollectionStore } from './create-collection-store';
import type { CurrencyCode, ExpenseRecord, OneTimeExpense, Timestamp } from '@/types/firestore';

const store = createCollectionStore<ExpenseRecord>('expenses');

export const useExpensesStore = store.useStore;
export const subscribeExpenses = store.subscribe;

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in. Reads always
// come back as a real Timestamp instance, no cast needed there.
function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}

export type NewExpenseInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  date: Date;
};

// kind is always 'oneTime' here: the "Recurring monthly" toggle in
// ExpenseForm is UI-only for now — a real RecurringExpenseInstance needs a
// recurringExpenseId pointing at a recurringExpenses definition doc, and
// that collection/generation logic doesn't exist until a later stage (see
// CLAUDE.md Known Issues).
export function addExpense(input: NewExpenseInput) {
  const doc: Omit<OneTimeExpense, 'createdAt' | 'updatedAt'> = {
    kind: 'oneTime',
    recurringExpenseId: null,
    name: input.name,
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: 1, // no multi-currency yet — Stage 10
    amountInDefaultCurrency: input.amount,
    rateSource: 'manual',
    budgetedAmount: null,
    budgetedCurrency: null,
    amount: input.amount,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.add(doc);
}

type EditableExpenseFields = Pick<
  OneTimeExpense,
  'name' | 'categoryId' | 'date' | 'currency' | 'amount' | 'paid' | 'paidDate'
>;

// exchangeRateToDefault/budgetedAmount/budgetedCurrency/kind/recurringExpenseId
// are deliberately excluded — firestore.rules locks them after creation (FR-16).
export function updateExpense(id: string, patch: Partial<EditableExpenseFields>) {
  return store.update(id, patch);
}

export function setExpensePaid(id: string, paid: boolean) {
  return store.update(id, { paid, paidDate: paid ? toTimestamp(new Date()) : null });
}
