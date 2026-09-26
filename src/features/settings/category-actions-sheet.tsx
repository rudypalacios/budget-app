import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { ActionSheetItem } from '@/components/ui/action-sheet-item';
import { Divider } from '@/components/ui/divider';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import type { WithId } from '@/lib/firebase/firestore.types';
import { deleteCategory, updateCategory } from '@/store/categories';
import { showToast } from '@/store/toast';
import type { Category } from '@/types/firestore';

export type CategoryActionsSheetProps = {
  category: WithId<Category>;
  // References across every collection and lifecycle state (from
  // canDeleteCategory) — any at all blocks permanent deletion.
  blockingCount: number;
  onClose: () => void;
};

// The ⋮ menu for one category (ajustes-v2 prototype): Edit, Archive/
// Activate, Delete permanently. Delete is shown disabled up front, with the
// reason, when records still use the category — instead of only finding out
// after tapping it. Confirming the delete swaps this same sheet to a
// confirmation view rather than stacking a second Modal. Mounted only while
// open.
//
// Writes aren't awaited (Firestore resolves them only on server ack, which
// never comes offline); a real rejection gets an error toast.
export function CategoryActionsSheet({
  category,
  blockingCount,
  onClose,
}: CategoryActionsSheetProps) {
  const { t } = useTranslation();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isActive = category.lifecycleState === 'active';

  function onWriteFailed() {
    showToast(t('categories.saveFailed'));
  }

  function handleToggleActive() {
    updateCategory(category.id, { lifecycleState: isActive ? 'archived' : 'active' }).catch(
      onWriteFailed,
    );
    onClose();
    showToast(
      t(isActive ? 'categories.nowArchived' : 'categories.nowActive', { name: category.name }),
    );
  }

  function handleDelete() {
    deleteCategory(category.id)
      .then((result) => {
        // Only reachable if a record started using the category between
        // opening this sheet and confirming.
        if (!result.ok) {
          showToast(t('categories.deleteBlocked', { count: result.blockingCount }));
        }
      })
      .catch(onWriteFailed);
    onClose();
    showToast(t('categories.deleted', { name: category.name }));
  }

  if (isConfirmingDelete) {
    return (
      <ActionSheet isOpen onClose={onClose} title={t('categories.confirmDeleteTitle')}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('categories.confirmDeleteMessage', { name: category.name })}
        </ThemedText>
        <SheetButtons
          onCancel={() => setIsConfirmingDelete(false)}
          confirmLabel={t('categories.confirmDeleteButton')}
          confirmVariant="danger"
          onConfirm={handleDelete}
        />
      </ActionSheet>
    );
  }

  return (
    <ActionSheet isOpen onClose={onClose} title={category.name}>
      <ActionSheetItem
        icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
        label={t('common.edit')}
        description={t('categories.actions.editHint')}
        onPress={() => {
          onClose();
          router.push({ pathname: '/categories/[id]/edit', params: { id: category.id } });
        }}
      />
      <ActionSheetItem
        icon={
          isActive
            ? { ios: 'archivebox', android: 'archive', web: 'archive' }
            : { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }
        }
        label={t(isActive ? 'common.archive' : 'categories.actions.activate')}
        description={t(
          isActive ? 'categories.actions.archiveHint' : 'categories.actions.activateHint',
        )}
        onPress={handleToggleActive}
      />
      <Divider />
      <ActionSheetItem
        icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
        label={t('common.deletePermanently')}
        description={
          blockingCount > 0
            ? t('categories.deleteBlocked', { count: blockingCount })
            : t('categories.actions.deleteHint')
        }
        tone="danger"
        disabled={blockingCount > 0}
        onPress={() => setIsConfirmingDelete(true)}
      />
    </ActionSheet>
  );
}
