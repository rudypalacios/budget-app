import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/ui/action-sheet';
import { ActionSheetItem } from '@/components/ui/action-sheet-item';
import { Divider } from '@/components/ui/divider';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { RecurringGroup } from '@/types/firestore';

export type GroupActionsSheetProps = {
  group: WithId<RecurringGroup>;
  // From describeGroupUsage: records pointing at the group in any state.
  referenceCount: number;
  onRename: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onClose: () => void;
};

// The ⋮ menu for one recurring group. Deleting is only offered while no
// expense (in any state) points at the group; a group with history can only
// be archived, so which expenses belonged to it is never lost (owner
// decision, Ajustes redesign — same rule as categories).
export function GroupActionsSheet({
  group,
  referenceCount,
  onRename,
  onToggleActive,
  onDelete,
  onClose,
}: GroupActionsSheetProps) {
  const { t } = useTranslation();
  const isActive = group.lifecycleState === 'active';

  return (
    <ActionSheet isOpen onClose={onClose} title={group.name}>
      <ActionSheetItem
        icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
        label={t('common.rename')}
        description={t('recurringGroups.actions.renameHint')}
        onPress={onRename}
      />
      <ActionSheetItem
        icon={
          isActive
            ? { ios: 'archivebox', android: 'archive', web: 'archive' }
            : { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }
        }
        label={t(isActive ? 'common.archive' : 'recurringGroups.actions.activate')}
        description={t(
          isActive ? 'recurringGroups.actions.archiveHint' : 'recurringGroups.actions.activateHint',
        )}
        onPress={onToggleActive}
      />
      <Divider />
      <ActionSheetItem
        icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
        label={t('common.deletePermanently')}
        description={
          referenceCount > 0
            ? t('recurringGroups.deleteBlocked', { count: referenceCount })
            : t('recurringGroups.actions.deleteHint')
        }
        tone="danger"
        disabled={referenceCount > 0}
        onPress={onDelete}
      />
    </ActionSheet>
  );
}
