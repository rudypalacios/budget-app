import { createDocumentStore } from './create-document-store';
import { useRecurringExpensesStore } from './recurring-expenses';
import { useSessionStore } from './session';
import { firestoreClient } from '@/lib/firebase/firestore';
import type { SupportedLanguage } from '@/localization/i18n';
import type { UserSettings } from '@/types/firestore';

const store = createDocumentStore<UserSettings>();

export const useUserSettingsStore = store.useStore;
export const subscribeUserSettings = store.subscribe;

let seedInFlight = false;

// First-run seed for a brand-new account, mirroring seedDefaultCategories'
// seedInFlight guard (src/store/categories.ts) — fired from _layout.tsx once
// the settings-doc listener resolves with no doc yet.
export async function seedDefaultUserSettings(detectedLanguage: SupportedLanguage) {
  if (seedInFlight) return;
  seedInFlight = true;
  try {
    await store.set({
      defaultCurrency: 'GTQ',
      language: detectedLanguage,
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
  } catch (error) {
    // Fire-and-forget from _layout.tsx — same reasoning as
    // seedDefaultCategories: an in-flight write here can reject if the uid
    // it was writing for stops being valid mid-seed (e.g. a sign-out race),
    // and the next app launch's no-doc check will retry anyway.
    console.warn('[user-settings] default-settings seed failed:', error);
  } finally {
    seedInFlight = false;
  }
}

export type UpdateUserSettingsInput = Partial<
  Pick<UserSettings, 'defaultCurrency' | 'language' | 'theme' | 'trashRetentionDays' | 'reminders'>
>;

// The Save-button entry point (settings.tsx) — persists the whole form at
// once, per the Stage 6b decision note (one Save button, no autosave).
export async function updateUserSettings(patch: UpdateUserSettingsInput) {
  const current = useUserSettingsStore.getState().data;
  const currencyChanged =
    patch.defaultCurrency != null && patch.defaultCurrency !== current?.defaultCurrency;

  await store.update(patch);

  if (currencyChanged) {
    await markBudgetRecommendationsStale();
  }
}

// docs/data-model.md §3: changing defaultCurrency must flip every
// recurringExpenses/{id}.budgetRecommendation.status to 'stale' in the same
// write, since the rolling-average/suggested-budget figures cached there are
// computed in the old default currency.
async function markBudgetRecommendationsStale() {
  const uid = useSessionStore.getState().uid;
  if (!uid) return;
  const recurringExpenseIds = useRecurringExpensesStore.getState().items.map((item) => item.id);
  if (recurringExpenseIds.length === 0) return;

  await firestoreClient.batchUpdate(
    recurringExpenseIds.map((id) => ({
      path: `users/${uid}/recurringExpenses/${id}`,
      data: { 'budgetRecommendation.status': 'stale' },
    })),
  );
}
