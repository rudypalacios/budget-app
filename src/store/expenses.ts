import { createCollectionStore } from './create-collection-store';
import { firestoreClient } from '@/lib/firebase/firestore';
import type {
  CurrencyCode,
  ExpenseRecord,
  OneTimeExpense,
  RateSource,
  RecurringExpenseInstance,
  Timestamp,
} from '@/types/firestore';

const store = createCollectionStore<ExpenseRecord>('expenses');

export const useExpensesStore = store.useStore;
export const subscribeExpenses = store.subscribe;

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in. Reads always
// come back as a real Timestamp instance, no cast needed there. Exported
// for callers that build an update patch outside this module (e.g.
// expenses/[id]/edit.tsx setting a picked due date).
export function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}

export type NewExpenseInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  // Rate for `currency` -> the app's default currency at entry time,
  // captured once and never recalculated (FR-16). 1 when currency already
  // is the default currency.
  exchangeRateToDefault: number;
  rateSource: RateSource;
  date: Date;
  // A one-time expense can be something already spent (paid) or a planned
  // future expense entered ahead of time (unpaid) — the caller's form
  // decides the default (off on the full form, on for quick-add's
  // already-spent fast path). Unlike a RecurringExpenseInstance
  // (setExpenseInstanceAt below), which always starts unpaid until settled
  // on the Payments dashboard, this is a one-off, user-set initial state.
  paid?: boolean;
};

export function addExpense(input: NewExpenseInput) {
  const paid = input.paid ?? false;
  const doc: Omit<OneTimeExpense, 'createdAt' | 'updatedAt'> = {
    kind: 'oneTime',
    recurringExpenseId: null,
    name: input.name,
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    amountInDefaultCurrency: input.amount * input.exchangeRateToDefault,
    rateSource: input.rateSource,
    budgetedAmount: null,
    budgetedCurrency: null,
    amount: input.amount,
    paid,
    paidDate: paid ? toTimestamp(new Date()) : null,
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
  if (patch.amount === undefined) {
    return store.update(id, patch);
  }
  // amountInDefaultCurrency is denormalized from amount * the record's own
  // immutable exchangeRateToDefault — recompute it here whenever amount
  // changes so it doesn't go stale (previously a Known Issue: edits never
  // touched this field at all).
  const expense = store.useStore.getState().items.find((item) => item.id === id);
  const exchangeRateToDefault = expense?.exchangeRateToDefault ?? 1;
  return store.update(id, {
    ...patch,
    amountInDefaultCurrency: patch.amount * exchangeRateToDefault,
  });
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
  // Snapshotted from the recurring definition's own rate at generation
  // time (data-model.md §8) — never touched again by later definition edits.
  exchangeRateToDefault: number;
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
    exchangeRateToDefault: input.exchangeRateToDefault,
    // amount is null until paid (data-model.md §6), so there's no real
    // "amount in default currency" yet either — the budgeted figure is the
    // best available estimate until setExpensePaid/updateExpense supply a
    // real amount.
    amountInDefaultCurrency: input.budgetedAmount * input.exchangeRateToDefault,
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
