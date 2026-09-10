import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRowDragAndDrop, type RowDragAndDrop } from '@/hooks/use-row-drag-and-drop';
import { suggestGroupName, type DropAction, type GroupableItem } from '@/lib/drag-drop-groups';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { Category } from '@/types/firestore';

export type GroupCreatePrompt<T extends GroupableItem> = { draggedItem: T; otherItem: T };

export type GroupDragOrchestration<T extends GroupableItem> = {
  dragAndDrop: RowDragAndDrop<T>;
  groupCreatePrompt: GroupCreatePrompt<T> | null;
  createGroupSuggestedName: string;
  handleConfirmCreateGroup: (name: string) => Promise<void>;
  handleCancelCreateGroup: () => void;
};

// Expenses-grouping follow-up — the small glue that was previously wired by
// hand in (tabs)/index.tsx (handleDropResolved/groupCreatePrompt/
// handleConfirmCreateGroup), now shared across all three drag-and-drop call
// sites (Dashboard, Expenses tab's "Una vez" and "Recurrentes" sections).
// Never calls a store function itself — same "gesture/orchestration knows
// nothing about Firestore" split use-row-drag-and-drop.ts already
// established — so each screen supplies its own two store-backed
// callbacks:
// - assignGroup(id, groupId): a plain field write (null clears, a string
//   joins), used for the 'clearGroup'/'assignToGroup' DropActions.
// - createGroupAndAssign(name, draggedId, otherId): creates a new
//   RecurringGroup and assigns both ids to it, used only after the
//   name-confirm dialog (driven by groupCreatePrompt/
//   createGroupSuggestedName/handleConfirmCreateGroup below) is accepted.
export function useGroupDragOrchestration<T extends GroupableItem>(
  allItems: T[],
  categories: WithId<Category>[],
  assignGroup: (id: string, groupId: string | null) => void | Promise<void>,
  createGroupAndAssign: (name: string, draggedId: string, otherId: string) => Promise<void>,
): GroupDragOrchestration<T> {
  const { t } = useTranslation();
  // Resolves a createGroup DropAction's otherRowId (an id only) back to a
  // real item, regardless of which section/bucket/group it's currently
  // rendered under — the caller passes every currently-rendered groupable
  // item, flattened, same as (tabs)/index.tsx's flattenAllRows used to.
  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  // Set only for a createGroup drop, never for the other DropAction kinds,
  // which call assignGroup directly with no confirmation.
  const [groupCreatePrompt, setGroupCreatePrompt] = useState<GroupCreatePrompt<T> | null>(null);

  function handleDropResolved(draggedItem: T, action: DropAction) {
    if (action.type === 'noop') return;
    if (action.type === 'clearGroup') {
      assignGroup(draggedItem.id, null);
      return;
    }
    if (action.type === 'assignToGroup') {
      assignGroup(draggedItem.id, action.groupId);
      return;
    }
    const otherItem = itemsById.get(action.otherRowId);
    if (!otherItem) return;
    setGroupCreatePrompt({ draggedItem, otherItem });
  }

  const dragAndDrop = useRowDragAndDrop(handleDropResolved);

  async function handleConfirmCreateGroup(name: string) {
    if (!groupCreatePrompt || !name.trim()) return;
    const { draggedItem, otherItem } = groupCreatePrompt;
    await createGroupAndAssign(name, draggedItem.id, otherItem.id);
    setGroupCreatePrompt(null);
  }

  function handleCancelCreateGroup() {
    setGroupCreatePrompt(null);
  }

  const createGroupSuggestedName = groupCreatePrompt
    ? (suggestGroupName(groupCreatePrompt.draggedItem, groupCreatePrompt.otherItem, categories) ??
      t('recurringGroups.defaultName'))
    : '';

  return { dragAndDrop, groupCreatePrompt, createGroupSuggestedName, handleConfirmCreateGroup, handleCancelCreateGroup };
}
