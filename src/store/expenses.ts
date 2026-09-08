import { createCollectionStore } from './create-collection-store';
import { firestoreClient } from '@/lib/firebase/firestore';
import { archiveTransition, restoreTransition, trashTransition } from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { trimName } from '@/lib/text-input';
import { recomputeBudgetRecommendation } from './recurring-expenses';
import { useUserSettingsStore } from './user-settings';
import type {
  ArchivableState,
  CurrencyCode,
  ExpenseRecord,
  OneTimeExpense,
  RateSource,
  RecurringExpenseInstance,
} from '@/types/firestore';

const store = createCollectionStore<ExpenseRecord>('expenses');

export const useExpensesStore = store.useStore;
export const subscribeExpenses = store.subscribe;

// Re-exported for callers that build an update patch outside this module
// (e.g. expenses/[id]/edit.tsx setting a picked due date).
export { toTimestamp };

// data-model.md §9: a recurring expense's budgetRecommendation recomputes
// whenever a linked instance is marked paid/edited/restored. `kind`/
// `recurringExpenseId` are immutable on an already-existing record, so
// reading them from store state right after our own write is safe
// regardless of the collection listener's timing (see recomputeBudgetRecommendation's
// own budgetedAmountOverride comment for the field that *isn't* safe that way).
async function recomputeIfRecurringInstance(id: string) {
  const record = store.useStore.getState().items.find((item) => item.id === id);
  if (record?.kind === 'recurringInstance') {
    await recomputeBudgetRecommendation(record.recurringExpenseId);
  }
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
    name: trimName(input.name),
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
    // input.date, not new Date() — creating an already-paid one-time
    // expense is often a retroactive log entry (e.g. yesterday's
    // restaurant, already settled), so paidDate should reflect the date
    // the user entered, not the moment of data entry. Contrast with
    // setExpensePaid below, where "now" is correct: that's a live
    // "marking this paid right now" action, not a backdated log.
    paidDate: paid ? toTimestamp(input.date) : null,
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
export async function updateExpense(id: string, patch: Partial<EditableExpenseFields>) {
  const trimmedPatch = patch.name !== undefined ? { ...patch, name: trimName(patch.name) } : patch;
  if (trimmedPatch.amount === undefined) {
    await store.update(id, trimmedPatch);
  } else {
    // amountInDefaultCurrency is denormalized from amount * the record's own
    // immutable exchangeRateToDefault — recompute it here whenever amount
    // changes so it doesn't go stale (previously a Known Issue: edits never
    // touched this field at all).
    const expense = store.useStore.getState().items.find((item) => item.id === id);
    const exchangeRateToDefault = expense?.exchangeRateToDefault ?? 1;
    await store.update(id, {
      ...trimmedPatch,
      amountInDefaultCurrency: trimmedPatch.amount * exchangeRateToDefault,
    });
  }
  if (patch.amount !== undefined || patch.paid !== undefined) {
    await recomputeIfRecurringInstance(id);
  }
}

// `amount` is only meaningful when marking paid (the Dashboard's
// confirm-amount modal, recurring instances only — see
// confirm-amount-modal.tsx) — it corrects the instance's amount in the same
// write, rather than needing a separate updateExpense call.
export async function setExpensePaid(id: string, paid: boolean, amount?: number) {
  if (paid && amount !== undefined) {
    const expense = store.useStore.getState().items.find((item) => item.id === id);
    const exchangeRateToDefault = expense?.exchangeRateToDefault ?? 1;
    await store.update(id, {
      paid,
      paidDate: toTimestamp(new Date()),
      amount,
      amountInDefaultCurrency: amount * exchangeRateToDefault,
    });
  } else {
    await store.update(id, { paid, paidDate: paid ? toTimestamp(new Date()) : null });
  }
  await recomputeIfRecurringInstance(id);
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

// FR-4a/4b (data-model.md §7) — see src/lib/lifecycle-transitions.ts for the
// actual state-machine math shared across expenses/incomes/recurring
// definitions. Applies to both one-time and recurring-instance rows
// (independent per-document, never cascaded from the parent definition).
export function archiveExpense(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashExpense(id: string) {
  const expense = store.useStore.getState().items.find((item) => item.id === id);
  if (!expense) throw new Error(`expenses store: trashExpense(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(expense.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Engine-only for now (Stage 12) — no UI calls this yet, restore/purge get a
// real screen in Stage 17. Exercised by unit tests in the meantime.
//
// Deliberately not `async` — the not-currently-trashed guard below needs to
// throw synchronously (matching trashExpense/trashRecurringExpense's same
// guard idiom), which an `async function` can't do: it converts every throw,
// even one before the first `await`, into a rejected Promise instead.
export function restoreExpense(id: string) {
  const expense = store.useStore.getState().items.find((item) => item.id === id);
  if (!expense?.trashedFromState) {
    throw new Error(`expenses store: restoreExpense(${id}) — not currently trashed`);
  }
  return store
    .update(id, restoreTransition(expense.trashedFromState, expense.archivedAt))
    .then(() => recomputeIfRecurringInstance(id));
}

export function purgeExpense(id: string) {
  return store.remove(id);
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
