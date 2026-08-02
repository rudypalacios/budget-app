import { createCollectionStore } from './create-collection-store';
import type { Category } from '@/types/firestore';

const store = createCollectionStore<Category>('categories');

export const useCategoriesStore = store.useStore;
export const subscribeCategories = store.subscribe;

// Seeded once on a brand-new account (see bootstrapSession in
// src/store/session.ts) — data-model.md §4's isSystemDefault distinguishes
// these from categories the user creates afterward via addCategory below.
export const DEFAULT_CATEGORY_SEED: { name: string; type: Category['type'] }[] = [
  { name: 'Rent', type: 'expense' },
  { name: 'Groceries', type: 'expense' },
  { name: 'Transport', type: 'expense' },
  { name: 'Utilities', type: 'expense' },
  { name: 'Entertainment', type: 'expense' },
  { name: 'Salary', type: 'income' },
  { name: 'Freelance', type: 'income' },
];

let seedInFlight = false;

// Guards against overlapping calls (e.g. React effect double-invoke in dev)
// writing the seed twice — doesn't guard against re-seeding an account that
// later gets purged down to zero categories (Stage 11 territory; a proper
// "already seeded" flag belongs on the users/{uid} settings doc once that
// exists).
export async function seedDefaultCategories() {
  if (seedInFlight) return;
  seedInFlight = true;
  try {
    for (const [index, seed] of DEFAULT_CATEGORY_SEED.entries()) {
      await store.add({
        name: seed.name,
        type: seed.type,
        color: null,
        icon: null,
        order: index,
        isSystemDefault: true,
        lifecycleState: 'active',
        monthlyBudget: null,
      });
    }
  } catch (error) {
    // Fire-and-forget from _layout.tsx (never awaited/.catch()ed) — same
    // reasoning as runRecurringGeneration's catch: an in-flight write here
    // can reject with permission-denied if the uid it was writing for stops
    // being valid mid-seed (e.g. a sign-out race), and an unhandled
    // rejection would otherwise crash rather than just skip a seed attempt
    // that the next app launch's zero-categories check will retry anyway.
    console.warn('[categories] default-category seed failed:', error);
  } finally {
    seedInFlight = false;
  }
}

export function addCategory(input: { name: string; type: Category['type']; monthlyBudget?: number | null }) {
  return store.add({
    name: input.name,
    type: input.type,
    color: null,
    icon: null,
    order: Date.now(),
    isSystemDefault: false,
    lifecycleState: 'active',
    // No suggestion is possible yet at creation time — the category doesn't
    // exist, so it can't already be a recurring expense's categoryId (Stage
    // 13). Left unset unless the user typed one in on the create form.
    monthlyBudget: input.monthlyBudget ?? null,
  });
}

export function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'type' | 'color' | 'icon' | 'order' | 'lifecycleState' | 'monthlyBudget'>>,
) {
  return store.update(id, patch);
}
