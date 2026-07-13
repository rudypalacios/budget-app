import { createCollectionStore } from './create-collection-store';
import { firestoreClient } from '@/lib/firebase/firestore';
import type {
  CurrencyCode,
  ExpenseRecord,
  OneTimeExpense,
  RecurringExpenseInstance,
  Timestamp,
} from '@/types/firestore';

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

// A one-time expense is a record of something already spent — unlike a
// RecurringExpenseInstance (setExpenseInstanceAt below), which represents an
// upcoming bill and starts unpaid until settled on the Payments dashboard —
// so it's created paid immediately rather than going through
// setExpensePaid() as a separate step.
export function addExpense(input: NewExpenseInput) {
  const now = new Date();
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
    paid: true,
    paidDate: toTimestamp(now),
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

// Recurring-instance only (Stage 8, Payments Dashboard) — see
// RecurringExpenseInstance.skipped in src/types/firestore.ts and
// data-model.md §12. Callers are responsible for not offering this on a
// OneTimeExpense row, since the field doesn't exist on that variant.
//
// The cast is needed because store.update()'s patch type is keyed off
// ExpenseRecord (the OneTimeExpense | RecurringExpenseInstance union) —
// TypeScript's keyof over a union only includes fields common to every
// member, so 'skipped'/'skippedAt' (RecurringExpenseInstance-only) aren't
// assignable without it. Firestore's updateDoc takes a plain object at
// runtime regardless, so this is safe as long as callers only invoke this
// for kind === 'recurringInstance' rows.
export function setExpenseSkipped(id: string, skipped: boolean) {
  const patch: Partial<Pick<RecurringExpenseInstance, 'skipped' | 'skippedAt'>> = {
    skipped,
    skippedAt: skipped ? toTimestamp(new Date()) : null,
  };
  return store.update(id, patch as Partial<Omit<ExpenseRecord, 'createdAt' | 'updatedAt'>>);
}

export type ExpenseInstanceInput = {
  recurringExpenseId: string;
  categoryId: string;
  name: string;
  date: Date;
  currency: CurrencyCode;
  budgetedAmount: number;
  budgetedCurrency: CurrencyCode;
};

// Deterministic-ID write for recurring-instance generation (Stage 6b) — see
// src/store/recurring-generation.ts, which computes `id` as
// `{recurringExpenseId}_{yyyy-MM}` per data-model.md §6/§9.
export function setExpenseInstanceAt(id: string, input: ExpenseInstanceInput) {
  const doc: Omit<RecurringExpenseInstance, 'createdAt' | 'updatedAt'> = {
    kind: 'recurringInstance',
    recurringExpenseId: input.recurringExpenseId,
    name: input.name,
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: 1, // no multi-currency yet — Stage 10
    // amount is null until paid (data-model.md §6), so there's no real
    // "amount in default currency" yet either — the budgeted figure is the
    // best available estimate until setExpensePaid/updateExpense supply a
    // real amount.
    amountInDefaultCurrency: input.budgetedAmount,
    rateSource: 'manual',
    budgetedAmount: input.budgetedAmount,
    budgetedCurrency: input.budgetedCurrency,
    amount: null,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.setAt(id, doc);
}

// Catch-up generation (data-model.md §9) needs "the last period already
// generated for this definition" to know where to resume from — derived by
// querying max(date), no extra field required, per the doc.
export async function getLastExpenseInstanceDate(
  uid: string,
  recurringExpenseId: string,
): Promise<Date | null> {
  const docs = await firestoreClient.getDocs<ExpenseRecord>(`users/${uid}/expenses`, {
    where: [['recurringExpenseId', '==', recurringExpenseId]],
    orderBy: [['date', 'desc']],
    limit: 1,
  });
  return docs[0] ? docs[0].date.toDate() : null;
}
