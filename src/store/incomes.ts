import { createCollectionStore } from './create-collection-store';
import { firestoreClient } from '@/lib/firebase/firestore';
import { archiveTransition, restoreTransition, trashTransition, type RestorableRecord } from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { trimName } from '@/lib/text-input';
import { useUserSettingsStore } from './user-settings';
import type { ArchivableState, CurrencyCode, IncomeRecord, OneTimeIncome, RateSource, RecurringIncomeInstance } from '@/types/firestore';

const store = createCollectionStore<IncomeRecord>('incomes');

export const useIncomesStore = store.useStore;
export const subscribeIncomes = store.subscribe;

// Re-exported for callers that build an update patch outside this module
// (e.g. income/[id]/edit.tsx setting a picked due date).
export { toTimestamp };

export type NewIncomeInput = {
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
  // Whether this income has already been received — user-set initial state,
  // defaulting to unpaid (expected/future income) unless the caller's form
  // says otherwise.
  paid?: boolean;
};

// kind is always 'oneTime' here: the "Recurring" toggle in IncomeForm is
// UI-only for now — a real RecurringIncomeInstance needs a recurringIncomeId
// pointing at a recurringIncomes definition doc, and that collection doesn't
// exist until a later stage (see CLAUDE.md Known Issues).
export function addIncome(input: NewIncomeInput) {
  const paid = input.paid ?? false;
  const doc: Omit<OneTimeIncome, 'createdAt' | 'updatedAt'> = {
    kind: 'oneTime',
    recurringIncomeId: null,
    name: trimName(input.name),
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    amountInDefaultCurrency: input.amount * input.exchangeRateToDefault,
    rateSource: input.rateSource,
    amount: input.amount,
    paid,
    // input.date, not new Date() — same reasoning as addExpense in
    // expenses.ts: creating an already-received one-time income is often
    // a retroactive log entry, so paidDate should reflect the entered
    // date, not the moment of data entry.
    paidDate: paid ? toTimestamp(input.date) : null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.add(doc);
}

type EditableIncomeFields = Pick<
  OneTimeIncome,
  'name' | 'categoryId' | 'date' | 'currency' | 'amount' | 'paid' | 'paidDate'
>;

// exchangeRateToDefault/kind/recurringIncomeId are deliberately excluded —
// firestore.rules locks them after creation (FR-16).
export function updateIncome(id: string, patch: Partial<EditableIncomeFields>) {
  const trimmedPatch = patch.name !== undefined ? { ...patch, name: trimName(patch.name) } : patch;
  if (trimmedPatch.amount === undefined) {
    return store.update(id, trimmedPatch);
  }
  // amountInDefaultCurrency is denormalized from amount * the record's own
  // immutable exchangeRateToDefault — recompute it here whenever amount
  // changes so it doesn't go stale (previously a Known Issue: edits never
  // touched this field at all).
  const income = store.useStore.getState().items.find((item) => item.id === id);
  const exchangeRateToDefault = income?.exchangeRateToDefault ?? 1;
  return store.update(id, {
    ...trimmedPatch,
    amountInDefaultCurrency: trimmedPatch.amount * exchangeRateToDefault,
  });
}

// `amount` is only meaningful when marking received (the Dashboard's
// confirm-amount modal, recurring instances only — see
// confirm-amount-modal.tsx) — it corrects the instance's amount in the same
// write, rather than needing a separate updateIncome call.
export function setIncomeReceived(id: string, paid: boolean, amount?: number) {
  if (paid && amount !== undefined) {
    const income = store.useStore.getState().items.find((item) => item.id === id);
    const exchangeRateToDefault = income?.exchangeRateToDefault ?? 1;
    return store.update(id, {
      paid,
      paidDate: toTimestamp(new Date()),
      amount,
      amountInDefaultCurrency: amount * exchangeRateToDefault,
    });
  }
  return store.update(id, { paid, paidDate: paid ? toTimestamp(new Date()) : null });
}

// Recurring-instance only (Stage 8, Payments Dashboard) — see
// RecurringIncomeInstance.skipped in src/types/firestore.ts and
// data-model.md §12. Callers are responsible for not offering this on a
// OneTimeIncome row, since the field doesn't exist on that variant.
//
// The cast is needed because store.update()'s patch type is keyed off
// IncomeRecord (the OneTimeIncome | RecurringIncomeInstance union) — see
// the matching comment on setExpenseSkipped in src/store/expenses.ts.
export function setIncomeSkipped(id: string, skipped: boolean) {
  const patch: Partial<Pick<RecurringIncomeInstance, 'skipped' | 'skippedAt'>> = {
    skipped,
    skippedAt: skipped ? toTimestamp(new Date()) : null,
  };
  return store.update(id, patch as Partial<Omit<IncomeRecord, 'createdAt' | 'updatedAt'>>);
}

export type IncomeInstanceInput = {
  recurringIncomeId: string;
  categoryId: string;
  name: string;
  date: Date;
  currency: CurrencyCode;
  // Snapshotted from the recurring definition's own rate at generation
  // time (data-model.md §8) — never touched again by later definition edits.
  exchangeRateToDefault: number;
  amount: number;
};

// Deterministic-ID write for recurring-instance generation (Stage 6b) — see
// src/store/recurring-generation.ts, which computes `id` as
// `{recurringIncomeId}_{yyyy-MM-dd}` per data-model.md §6/§9.
export function setIncomeInstanceAt(id: string, input: IncomeInstanceInput) {
  const doc: Omit<RecurringIncomeInstance, 'createdAt' | 'updatedAt'> = {
    kind: 'recurringInstance',
    recurringIncomeId: input.recurringIncomeId,
    name: input.name,
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    amountInDefaultCurrency: input.amount * input.exchangeRateToDefault,
    rateSource: 'manual',
    // Unlike expenses, income's `amount` is never null — it's the
    // expected/received amount, pre-filled from the definition and editable
    // to match what actually arrived (data-model.md §6).
    amount: input.amount,
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
export function archiveIncome(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashIncome(id: string) {
  const income = store.useStore.getState().items.find((item) => item.id === id);
  if (!income) throw new Error(`incomes store: trashIncome(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(income.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Engine-only for now (Stage 12) — no UI calls this yet, restore/purge get a
// real screen in Stage 17. Exercised by unit tests in the meantime.
//
// Restores either a trashed or a merely-archived record — see
// lifecycle-transitions.ts's restoreTransition comment for the bug this
// fixed (previously only the trashed case worked; restoring straight from
// Archive threw for every income).
export function restoreIncome(id: string) {
  const income = store.useStore.getState().items.find((item) => item.id === id);
  if (!income || income.lifecycleState === 'active') {
    throw new Error(`incomes store: restoreIncome(${id}) — not currently archived or trashed`);
  }
  return store.update(id, restoreTransition(income as RestorableRecord));
}

export function purgeIncome(id: string) {
  return store.remove(id);
}

// Catch-up generation (data-model.md §9) needs "the last period already
// generated for this definition" to know where to resume from — derived by
// querying max(date), no extra field required, per the doc.
export async function getLastIncomeInstanceDate(
  uid: string,
  recurringIncomeId: string,
): Promise<Date | null> {
  const docs = await firestoreClient.getDocs<IncomeRecord>(`users/${uid}/incomes`, {
    where: [['recurringIncomeId', '==', recurringIncomeId]],
    orderBy: [['date', 'desc']],
    limit: 1,
  });
  return docs[0] ? docs[0].date.toDate() : null;
}
