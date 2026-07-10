import { createCollectionStore } from './create-collection-store';
import { firestoreClient } from '@/lib/firebase/firestore';
import type {
  CurrencyCode,
  IncomeRecord,
  OneTimeIncome,
  RecurringIncomeInstance,
  Timestamp,
} from '@/types/firestore';

const store = createCollectionStore<IncomeRecord>('incomes');

export const useIncomesStore = store.useStore;
export const subscribeIncomes = store.subscribe;

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in. Reads always
// come back as a real Timestamp instance, no cast needed there.
function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}

export type NewIncomeInput = {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  date: Date;
};

// kind is always 'oneTime' here: the "Recurring" toggle in IncomeForm is
// UI-only for now — a real RecurringIncomeInstance needs a recurringIncomeId
// pointing at a recurringIncomes definition doc, and that collection doesn't
// exist until a later stage (see CLAUDE.md Known Issues).
export function addIncome(input: NewIncomeInput) {
  const doc: Omit<OneTimeIncome, 'createdAt' | 'updatedAt'> = {
    kind: 'oneTime',
    recurringIncomeId: null,
    name: input.name,
    categoryId: input.categoryId,
    date: toTimestamp(input.date),
    currency: input.currency,
    exchangeRateToDefault: 1, // no multi-currency yet — Stage 10
    amountInDefaultCurrency: input.amount,
    rateSource: 'manual',
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

type EditableIncomeFields = Pick<
  OneTimeIncome,
  'name' | 'categoryId' | 'date' | 'currency' | 'amount' | 'paid' | 'paidDate'
>;

// exchangeRateToDefault/kind/recurringIncomeId are deliberately excluded —
// firestore.rules locks them after creation (FR-16).
export function updateIncome(id: string, patch: Partial<EditableIncomeFields>) {
  return store.update(id, patch);
}

export function setIncomeReceived(id: string, paid: boolean) {
  return store.update(id, { paid, paidDate: paid ? toTimestamp(new Date()) : null });
}

export type IncomeInstanceInput = {
  recurringIncomeId: string;
  categoryId: string;
  name: string;
  date: Date;
  currency: CurrencyCode;
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
    exchangeRateToDefault: 1, // no multi-currency yet — Stage 10
    amountInDefaultCurrency: input.amount,
    rateSource: 'manual',
    // Unlike expenses, income's `amount` is never null — it's the
    // expected/received amount, pre-filled from the definition and editable
    // to match what actually arrived (data-model.md §6).
    amount: input.amount,
    paid: false,
    paidDate: null,
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
