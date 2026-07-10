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
      });
    }
  } finally {
    seedInFlight = false;
  }
}

export function addCategory(input: { name: string; type: Category['type'] }) {
  return store.add({
    name: input.name,
    type: input.type,
    color: null,
    icon: null,
    order: Date.now(),
    isSystemDefault: false,
    lifecycleState: 'active',
  });
}

export function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'type' | 'color' | 'icon' | 'order' | 'lifecycleState'>>,
) {
  return store.update(id, patch);
}
