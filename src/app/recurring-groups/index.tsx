import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { Spacing } from '@/constants/theme';
import { GroupActionsSheet } from '@/features/settings/group-actions-sheet';
import { GroupNameSheet } from '@/features/settings/group-name-sheet';
import { SettingsCard } from '@/features/settings/settings-card';
import { SettingsRow } from '@/features/settings/settings-row';
import { SettingsSectionTitle } from '@/features/settings/settings-section-title';
import type { WithId } from '@/lib/firebase/firestore.types';
import { goBack } from '@/lib/navigation';
import { describeGroupUsage } from '@/lib/recurring-groups';
import { useExpensesStore } from '@/store/expenses';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import {
  addRecurringGroup,
  archiveRecurringGroup,
  purgeRecurringGroup,
  renameRecurringGroup,
  trashRecurringGroup,
  unarchiveRecurringGroup,
  useRecurringGroupsStore,
} from '@/store/recurring-groups';
import { showToast } from '@/store/toast';
import type { RecurringGroup } from '@/types/firestore';

type GroupSheet =
  | { kind: 'create' }
  | { kind: 'menu'; group: WithId<RecurringGroup> }
  | { kind: 'rename'; group: WithId<RecurringGroup> }
  | { kind: 'confirmDelete'; group: WithId<RecurringGroup> };

const SECTIONS = [
  { state: 'active', titleKey: 'recurringGroups.activeSection' },
  { state: 'archived', titleKey: 'recurringGroups.archivedSection' },
] as const;

// Recurring groups admin (Stage 18 redo, FR-21, data-model.md §11), laid out
// per the ajustes-v2 prototype: each group with its expense count and member
// names, and a ⋮ menu for Rename / Archive / Delete.
//
// Deleting is only possible while no expense, in any state, points at the
// group (see describeGroupUsage) — a group with history can only be
// archived, so which expenses belonged to it is never lost. Archiving never
// touches the members: they keep their recurringGroupId, just render
// ungrouped while the group is archived (buildDashboardSections only groups
// by active groups), and are grouped again once it's reactivated.
//
// Writes aren't awaited (Firestore resolves them only on server ack, which
// never comes offline); a real rejection gets an error toast.
export default function RecurringGroupsScreen() {
  const { t } = useTranslation();
  const groups = useRecurringGroupsStore((state) => state.items).filter(
    (group) => group.lifecycleState !== 'trashed',
  );
  const expenses = useExpensesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);

  const [sheet, setSheet] = useState<GroupSheet | null>(null);

  function closeSheet() {
    setSheet(null);
  }

  function onWriteFailed() {
    showToast(t('recurringGroups.saveFailed'));
  }

  function handleCreate(name: string) {
    addRecurringGroup(name).catch(() => showToast(t('recurringGroups.createFailed')));
    closeSheet();
    showToast(t('recurringGroups.created', { name: name.trim() }));
  }

  function handleRename(group: WithId<RecurringGroup>, name: string) {
    renameRecurringGroup(group.id, name).catch(onWriteFailed);
    closeSheet();
    showToast(t('recurringGroups.renamed', { name: name.trim() }));
  }

  function handleToggleActive(group: WithId<RecurringGroup>) {
    const isActive = group.lifecycleState === 'active';
    (isActive ? archiveRecurringGroup(group.id) : unarchiveRecurringGroup(group.id)).catch(
      onWriteFailed,
    );
    closeSheet();
    showToast(
      t(isActive ? 'recurringGroups.nowArchived' : 'recurringGroups.nowActive', {
        name: group.name,
      }),
    );
  }

  // firestore.rules only allow deleting a group that's already 'trashed',
  // so this queues the trash update and then the delete. Both are queued
  // locally in order and reach the server in that order, so neither needs
  // awaiting — the delete sees the trashed state — and the pair survives
  // the app being closed while offline.
  function handleDelete(group: WithId<RecurringGroup>) {
    Promise.resolve()
      .then(() => {
        const trashed = trashRecurringGroup(group.id);
        const purged = purgeRecurringGroup(group.id);
        return Promise.all([trashed, purged]);
      })
      .catch(onWriteFailed);
    closeSheet();
    showToast(t('recurringGroups.deleted', { name: group.name }));
  }

  function renderRow(group: WithId<RecurringGroup>) {
    const usage = describeGroupUsage(group.id, expenses, recurringExpenses);
    return (
      <SettingsRow
        key={group.id}
        icon={{ ios: 'folder', android: 'folder', web: 'folder' }}
        title={group.name}
        subtitle={
          <View>
            <ThemedText type="caption">
              {t('recurringGroups.expenseCount', { count: usage.memberNames.length })}
            </ThemedText>
            {usage.memberNames.length > 0 && (
              <ThemedText type="caption">{usage.memberNames.join(', ')}</ThemedText>
            )}
          </View>
        }
        trailing={
          <IconButton
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            onPress={() => setSheet({ kind: 'menu', group })}
            accessibilityLabel={t('recurringGroups.actionsFor', { name: group.name })}
          />
        }
      />
    );
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('recurringGroups.manageTitle')} onBack={() => goBack('/settings')} />

      <ThemedText type="small" themeColor="textSecondary">
        {t('recurringGroups.intro')}
      </ThemedText>
      <Button
        label={t('recurringGroups.newGroupAction')}
        onPress={() => setSheet({ kind: 'create' })}
        style={styles.addButton}
      />

      {groups.length === 0 ? (
        <ThemedText type="caption">{t('recurringGroups.empty')}</ThemedText>
      ) : (
        SECTIONS.map(({ state, titleKey }) => {
          const inSection = groups.filter((group) => group.lifecycleState === state);
          if (inSection.length === 0) return null;
          return (
            <View key={state} style={styles.section}>
              <SettingsSectionTitle title={t(titleKey)} />
              <SettingsCard>{inSection.map(renderRow)}</SettingsCard>
            </View>
          );
        })
      )}

      {sheet?.kind === 'create' && (
        <GroupNameSheet
          title={t('recurringGroups.newGroupTitle')}
          initialName=""
          confirmLabel={t('common.create')}
          onConfirm={handleCreate}
          onClose={closeSheet}
        />
      )}
      {sheet?.kind === 'rename' && (
        <GroupNameSheet
          key={sheet.group.id}
          title={t('recurringGroups.renameTitle')}
          initialName={sheet.group.name}
          confirmLabel={t('common.save')}
          onConfirm={(name) => handleRename(sheet.group, name)}
          onClose={closeSheet}
        />
      )}
      {sheet?.kind === 'menu' && (
        <GroupActionsSheet
          key={sheet.group.id}
          group={sheet.group}
          referenceCount={
            describeGroupUsage(sheet.group.id, expenses, recurringExpenses).referenceCount
          }
          onRename={() => setSheet({ kind: 'rename', group: sheet.group })}
          onToggleActive={() => handleToggleActive(sheet.group)}
          onDelete={() => setSheet({ kind: 'confirmDelete', group: sheet.group })}
          onClose={closeSheet}
        />
      )}
      {sheet?.kind === 'confirmDelete' && (
        <ActionSheet isOpen onClose={closeSheet} title={t('recurringGroups.confirmDeleteTitle')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('recurringGroups.confirmDeleteMessage', { name: sheet.group.name })}
          </ThemedText>
          <SheetButtons
            onCancel={closeSheet}
            confirmLabel={t('common.deletePermanently')}
            confirmVariant="danger"
            onConfirm={() => handleDelete(sheet.group)}
          />
        </ActionSheet>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignSelf: 'flex-start',
  },
  section: {
    gap: Spacing.one + 2,
  },
});
