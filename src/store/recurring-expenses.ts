import { createCollectionStore } from './create-collection-store';
import {
  canRevertRecommendation,
  computeBudgetRecommendation,
  type RecommendationAction,
  type RecommendationSnapshot,
} from '@/lib/budget-recommendation';
import { firestoreClient } from '@/lib/firebase/firestore';
import { archiveTransition, restoreTransition, trashTransition } from '@/lib/lifecycle-transitions';
import { toTimestamp } from '@/lib/timestamp';
import { trimName } from '@/lib/text-input';
import { useSessionStore } from './session';
import { useUserSettingsStore } from './user-settings';
import type { ArchivableState, BudgetRecommendation, CurrencyCode, ExpenseRecord, RecurringExpense } from '@/types/firestore';

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
  // Stage 18 redo (FR-21, data-model.md §11) — optional recurringGroups/{id}
  // membership. null/omitted = ungrouped.
  recurringGroupId?: string | null;
};

export function addRecurringExpense(input: NewRecurringExpenseInput) {
  const doc: Omit<RecurringExpense, 'createdAt' | 'updatedAt'> = {
    name: trimName(input.name),
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency,
    exchangeRateToDefault: input.exchangeRateToDefault,
    dueDay: input.dueDay,
    startDate: toTimestamp(input.startDate),
    remindersEnabled: null,
    reminderLeadDays: null,
    budgetRecommendation: EMPTY_BUDGET_RECOMMENDATION,
    recurringGroupId: input.recurringGroupId ?? null,
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
  | 'name'
  | 'categoryId'
  | 'amount'
  | 'currency'
  | 'exchangeRateToDefault'
  | 'dueDay'
  | 'startDate'
  | 'recurringGroupId'
>;

// Editing amount changes whether drift holds against the (now-current)
// budgeted amount, even with no new paid instance — recompute right after,
// passing the just-written amount directly rather than re-reading store
// state, since the collection listener that backs it may not have caught up
// with this write yet. Converted to defaultCurrency before handing off to
// recomputeBudgetRecommendation (see that function's own comment) — the
// exchange rate itself isn't subject to the same race: if this same patch
// changed it, trimmedPatch.exchangeRateToDefault is the just-submitted value
// directly (no read needed); otherwise it's an unrelated, previously-settled
// field, so a store read for it carries no staleness risk here.
export async function updateRecurringExpense(id: string, patch: Partial<EditableRecurringExpenseFields>) {
  const trimmedPatch = patch.name !== undefined ? { ...patch, name: trimName(patch.name) } : patch;
  await store.update(id, trimmedPatch);
  if (trimmedPatch.amount !== undefined) {
    const definition = store.useStore.getState().items.find((item) => item.id === id);
    const exchangeRateToDefault = trimmedPatch.exchangeRateToDefault ?? definition?.exchangeRateToDefault ?? 1;
    await recomputeBudgetRecommendation(id, trimmedPatch.amount * exchangeRateToDefault);
  }
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

// FR-6a/data-model.md §9: recomputes the 6-month rolling average + drift
// status from the definition's last 6 paid instances.
// `budgetedAmountInDefaultCurrencyOverride` lets a caller that just wrote a
// new `amount` (updateRecurringExpense above) pass that value straight
// through instead of racing the collection listener's eventual-consistency
// window — the name spells out that it must already be converted, since
// `paidInstanceAmounts` below is always in defaultCurrency
// (`amountInDefaultCurrency`) and computeBudgetRecommendation's drift math
// assumes both sides of the comparison share a currency. Previously this
// took a raw override straight in the record's own currency and fell back to
// bare `definition.amount` the same way — comparing a possibly-foreign-currency
// number against a defaultCurrency average, which could both misfire a
// recommendation that wasn't real drift and suppress one that was.
export async function recomputeBudgetRecommendation(
  id: string,
  budgetedAmountInDefaultCurrencyOverride?: number,
): Promise<void> {
  const uid = useSessionStore.getState().uid;
  if (!uid) return;
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition) return;

  const paidInstances = await firestoreClient.getDocs<ExpenseRecord>(`users/${uid}/expenses`, {
    where: [
      ['recurringExpenseId', '==', id],
      ['paid', '==', true],
    ],
    orderBy: [['date', 'desc']],
    limit: 6,
  });

  const budgetRecommendation = computeBudgetRecommendation({
    paidInstanceAmounts: paidInstances.map((instance) => instance.amountInDefaultCurrency),
    budgetedAmount: budgetedAmountInDefaultCurrencyOverride ?? definition.amount * definition.exchangeRateToDefault,
    now: new Date(),
    previousStatus: definition.budgetRecommendation.status,
    dismissedAtAverageAmount: definition.budgetRecommendation.dismissedAtAverageAmount,
  });

  await store.update(id, { budgetRecommendation });
}

// data-model.md §9: "re-evaluated at read time... to catch drift missed by
// a stale cache" — resolves every recurringExpenses/{id}.budgetRecommendation
// that a bulk `status: 'stale'` write (e.g. defaultCurrency change, see
// markBudgetRecommendationsStale in user-settings.ts) left needing a real
// recompute. Call once when a screen that displays recommendations mounts.
export async function recomputeStaleBudgetRecommendations(): Promise<void> {
  const staleIds = store.useStore
    .getState()
    .items.filter((item) => item.lifecycleState === 'active' && item.budgetRecommendation.status === 'stale')
    .map((item) => item.id);

  await Promise.all(staleIds.map((id) => recomputeBudgetRecommendation(id)));
}

// FR-6d: auto-updates the budgeted amount to match the suggested figure and
// marks the recommendation accepted. A later recompute (next paid instance,
// or the next markBudgetRecommendationsStale-triggered pass) naturally
// re-evaluates drift against the new amount — no special "un-accept" path.
export function acceptBudgetRecommendation(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition) {
    throw new Error(`recurringExpenses store: acceptBudgetRecommendation(${id}) — not found`);
  }
  // suggestedBudgetedAmount is always in defaultCurrency (derived from paid
  // instances' amountInDefaultCurrency, see recomputeBudgetRecommendation),
  // but `amount` is denominated in this definition's own `currency` — divide
  // back through exchangeRateToDefault so amount * exchangeRateToDefault
  // still equals the accepted figure, instead of silently reinterpreting a
  // foreign-currency amount as if it were already in defaultCurrency.
  const suggested = definition.budgetRecommendation.suggestedBudgetedAmount;
  if (suggested === null) return Promise.resolve();

  return store.update(id, {
    amount: suggested / definition.exchangeRateToDefault,
    budgetRecommendation: { ...definition.budgetRecommendation, status: 'accepted' },
  });
}

// FR-6d: keeps the current budgeted amount. dismissedAtAverageAmount records
// the average at the moment of dismissal so a later recompute only
// re-surfaces the recommendation once the average has drifted even further
// (see computeBudgetRecommendation's staysDismissed logic).
export function dismissBudgetRecommendation(id: string) {
  const definition = store.useStore.getState().items.find((item) => item.id === id);
  if (!definition) {
    throw new Error(`recurringExpenses store: dismissBudgetRecommendation(${id}) — not found`);
  }

  return store.update(id, {
    budgetRecommendation: {
      ...definition.budgetRecommendation,
      status: 'dismissed',
      dismissedAt: toTimestamp(new Date()),
      dismissedAtAverageAmount: definition.budgetRecommendation.rollingAverageAmount,
    },
  });
}

// Fase 7 Undo for Accept/Keep on a budget recommendation. Goes through
// store.update directly because updateRecurringExpense only takes
// user-editable fields, and budgetRecommendation isn't one. Returns false
// (and writes nothing) when canRevertRecommendation says the definition has
// moved on since the action.
export function revertBudgetRecommendation(
  id: string,
  snapshot: RecommendationSnapshot,
  action: RecommendationAction,
): Promise<boolean> {
  const current = store.useStore.getState().items.find((item) => item.id === id);
  if (!current || !canRevertRecommendation(current, snapshot, action)) {
    return Promise.resolve(false);
  }
  return store
    .update(id, { amount: snapshot.amount, budgetRecommendation: snapshot.budgetRecommendation })
    .then(() => true);
}
