import { createCollectionStore } from './create-collection-store';
import {
  archiveTransition,
  restoreTransition,
  trashTransition,
  unarchiveTransition,
} from '@/lib/lifecycle-transitions';
import { trimName } from '@/lib/text-input';
import { useUserSettingsStore } from './user-settings';
import type { ArchivableState, RecurringGroup } from '@/types/firestore';

const store = createCollectionStore<RecurringGroup>('recurringGroups');

export const useRecurringGroupsStore = store.useStore;
export const subscribeRecurringGroups = store.subscribe;

export function addRecurringGroup(name: string) {
  const doc: Omit<RecurringGroup, 'createdAt' | 'updatedAt'> = {
    name: trimName(name),
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
  return store.add(doc);
}

export function renameRecurringGroup(id: string, name: string) {
  return store.update(id, { name: trimName(name) });
}

// FR-4a/4b/4e (data-model.md §7) — see the matching comment on
// archiveRecurringExpense/trashRecurringExpense in recurring-expenses.ts.
// Archiving/trashing the group entity itself only flips its own
// lifecycleState — it never touches its members' own recurringGroupId, so
// existing members stay linked (they simply stop being offered as a target
// in the "add to group" picker, same as any other archived/trashed record).
export function archiveRecurringGroup(id: string) {
  return store.update(id, archiveTransition(new Date()));
}

export function trashRecurringGroup(id: string) {
  const group = store.useStore.getState().items.find((item) => item.id === id);
  if (!group) throw new Error(`recurringGroups store: trashRecurringGroup(${id}) — not found`);
  const trashRetentionDays = useUserSettingsStore.getState().data?.trashRetentionDays ?? 30;
  return store.update(
    id,
    trashTransition(group.lifecycleState as ArchivableState, new Date(), trashRetentionDays),
  );
}

// Archive screen's Restore for an archived (never trashed) record — see
// unarchiveTransition.
export function unarchiveRecurringGroup(id: string) {
  return store.update(id, unarchiveTransition());
}

// Engine-only for now — no UI calls this yet, restore/purge get a real
// screen alongside expenses/incomes' own Archive/Trash flow (Stage 17).
export function restoreRecurringGroup(id: string) {
  const group = store.useStore.getState().items.find((item) => item.id === id);
  if (!group?.trashedFromState) {
    throw new Error(`recurringGroups store: restoreRecurringGroup(${id}) — not currently trashed`);
  }
  return store.update(id, restoreTransition(group.trashedFromState, group.archivedAt));
}

export function purgeRecurringGroup(id: string) {
  return store.remove(id);
}
