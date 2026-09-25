import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Divider } from '@/components/ui/divider';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { FormRowBreakpoint, Spacing } from '@/constants/theme';
import type { WithId } from '@/lib/firebase/firestore.types';
import { goBack } from '@/lib/navigation';
import {
  addRecurringGroup,
  archiveRecurringGroup,
  purgeRecurringGroup,
  renameRecurringGroup,
  restoreRecurringGroup,
  trashRecurringGroup,
  useRecurringGroupsStore,
} from '@/store/recurring-groups';
import { showToast } from '@/store/toast';
import type { RecurringGroup } from '@/types/firestore';

// Stage 18 redo (FR-21, data-model.md §11) — the "browse/rename/archive/
// delete a group" screen this Known Issue flagged as missing: creating a
// group inline from any "Grupo…" picker (recurring-group-field.tsx) always
// worked, but there was nowhere to manage an existing one outside that
// flow. Same list pattern as categories/index.tsx (active/archived toggle
// + permanent-delete confirm Dialog) — RecurringGroup does carry a real
// 'trashed' state (unlike Category), but this screen deliberately doesn't
// expose it as a separate step: "Delete permanently" trashes then purges
// in one action, since firestore.rules only allows purge from 'trashed'.
// Deleting a group never touches its members' own recurringGroupId — a
// member pointing at a since-deleted group id just isn't in
// buildDashboardSections' activeGroups list, so it silently renders as a
// plain ungrouped row (src/lib/recurring-groups.ts), same as an
// archived/trashed group's members already do.
export default function RecurringGroupsScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < FormRowBreakpoint;
  const groups = useRecurringGroupsStore((state) => state.items).filter(
    (group) => group.lifecycleState !== 'trashed',
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<WithId<RecurringGroup> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WithId<RecurringGroup> | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    await addRecurringGroup(newName);
    setIsCreating(false);
    setNewName('');
  }

  function toggleActive(group: WithId<RecurringGroup>) {
    if (group.lifecycleState === 'active') {
      archiveRecurringGroup(group.id);
    } else {
      restoreRecurringGroup(group.id);
    }
  }

  async function handleConfirmRename(name: string) {
    if (!renameTarget || !name.trim()) return;
    await renameRecurringGroup(renameTarget.id, name);
    setRenameTarget(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await trashRecurringGroup(deleteTarget.id);
    await purgeRecurringGroup(deleteTarget.id);
    showToast(t('recurringGroups.deleted', { name: deleteTarget.name }));
    setDeleteTarget(null);
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('recurringGroups.manageTitle')} onBack={() => goBack('/settings')} />

      <SectionHeader
        title={t('recurringGroups.allGroups')}
        actionLabel={t('recurringGroups.addAction')}
        onActionPress={() => setIsCreating(true)}
      />

      {isCreating && (
        <Card style={styles.card}>
          <TextField
            label={t('recurringGroups.newGroupName')}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('recurringGroups.newGroupNamePlaceholder')}
          />
          <View style={styles.actionRow}>
            <Button label={t('common.save')} onPress={handleCreate} disabled={!newName.trim()} />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => {
                setIsCreating(false);
                setNewName('');
              }}
            />
          </View>
        </Card>
      )}

      {groups.length === 0 ? (
        <ThemedText type="caption">{t('recurringGroups.empty')}</ThemedText>
      ) : (
        <Card style={styles.card}>
          {groups.map((group, index) => (
            <View key={group.id}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{group.name}</ThemedText>
                </View>
                <View style={styles.rowAside}>
                  <OverflowMenu
                    accessibilityLabel={t('common.actionsFor', { name: group.name })}
                    items={[
                      { label: t('common.rename'), onPress: () => setRenameTarget(group) },
                      {
                        label: t('common.deletePermanently'),
                        onPress: () => setDeleteTarget(group),
                      },
                    ]}
                  />
                  <View style={styles.switchRow}>
                    <ThemedText type="caption">
                      {group.lifecycleState === 'active'
                        ? t('recurringGroups.active')
                        : t('recurringGroups.archived')}
                    </ThemedText>
                    <Switch
                      value={group.lifecycleState === 'active'}
                      onValueChange={() => toggleActive(group)}
                      accessibilityLabel={t('recurringGroups.markAs', {
                        name: group.name,
                        state:
                          group.lifecycleState === 'active'
                            ? t('recurringGroups.state.archived')
                            : t('recurringGroups.state.active'),
                      })}
                    />
                  </View>
                </View>
              </View>
              {index < groups.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </Card>
      )}

      {renameTarget && (
        <GroupNameDialog
          key={renameTarget.id}
          isOpen
          title={t('recurringGroups.renameTitle')}
          initialName={renameTarget.name}
          onConfirm={handleConfirmRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      <Dialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('recurringGroups.confirmDeleteTitle')}
      >
        <ThemedText>
          {t('recurringGroups.confirmDeleteMessage', { name: deleteTarget?.name ?? '' })}
        </ThemedText>
        <View style={[styles.dialogActions, isNarrow && styles.dialogActionsNarrow]}>
          <Button
            label={t('common.deletePermanently')}
            variant="danger"
            onPress={handleConfirmDelete}
            style={isNarrow ? styles.dialogButtonNarrow : styles.dialogButton}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => setDeleteTarget(null)}
            style={isNarrow ? styles.dialogButtonNarrow : styles.dialogButton}
          />
        </View>
      </Dialog>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowAside: {
    gap: Spacing.one,
    alignItems: 'flex-end',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogActionsNarrow: {
    flexDirection: 'column',
  },
  dialogButton: {
    flex: 1,
  },
  dialogButtonNarrow: {
    width: '100%',
  },
});
