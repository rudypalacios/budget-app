import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { ActionSheetItem } from '@/components/ui/action-sheet-item';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmRecordsSheet } from '@/components/ui/confirm-records-sheet';
import { Divider } from '@/components/ui/divider';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { SettingsCard } from '@/features/settings/settings-card';
import { SettingsRow } from '@/features/settings/settings-row';
import { formatShortDate } from '@/lib/format-date';
import {
  collectArchivedRecords,
  isRecurringDefinitionType,
  isTrashableRecordType,
  type LifecycleRecord,
  type LifecycleRecordType,
} from '@/lib/lifecycle-records';
import { goBack } from '@/lib/navigation';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { trashLifecycleRecord, unarchiveLifecycleRecord } from '@/store/lifecycle-actions';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringGroupsStore } from '@/store/recurring-groups';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';

const TYPE_LABEL_KEY: Record<LifecycleRecordType, string> = {
  expense: 'lifecycle.type.expense',
  income: 'lifecycle.type.income',
  recurringExpense: 'lifecycle.type.recurringExpense',
  recurringIncome: 'lifecycle.type.recurringIncome',
  category: 'lifecycle.type.category',
  recurringGroup: 'lifecycle.type.recurringGroup',
};

function recordKey(record: Pick<LifecycleRecord, 'recordType' | 'id'>): string {
  return `${record.recordType}-${record.id}`;
}

// Stage 17 — the browse/restore half of Stage 12's archive/trash engine,
// laid out per the ajustes-v2 prototype. One flat list across every
// archivable type (expenses, income, recurring definitions, categories,
// recurring groups), newest-archived first — a separate destination from
// the Trash screen, not a tab within it. Bulk-select checkboxes + select-all
// mirror the Trash screen. Restore goes through ConfirmRecordsSheet, listing
// every affected record — found live that an unconfirmed Restore was too
// easy to trigger by mistake, and bulk selection made that worse. Move to
// Trash stays immediate, matching the app's Archive/Delete convention
// elsewhere; categories and groups can't go to the Trash at all.
//
// Writes aren't awaited (Firestore resolves them only on server ack, which
// never comes offline); a real rejection gets an error toast.
export default function ArchiveScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringGroups = useRecurringGroupsStore((state) => state.items);
  const trashRetentionDays = useUserSettingsStore((state) => state.data?.trashRetentionDays ?? 30);
  const uid = useSessionStore((state) => state.uid);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<LifecycleRecord | null>(null);
  const [restoreTargets, setRestoreTargets] = useState<LifecycleRecord[] | null>(null);

  const records = collectArchivedRecords(
    expenses,
    incomes,
    recurringExpenses,
    recurringIncomes,
    categories,
    recurringGroups,
  );
  const allSelected = records.length > 0 && selectedKeys.size === records.length;
  const selectedRecords = records.filter((record) => selectedKeys.has(recordKey(record)));

  function onWriteFailed() {
    showToast(t('lifecycle.saveFailed'));
  }

  function toggleSelected(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedKeys(allSelected ? new Set() : new Set(records.map(recordKey)));
  }

  function handleConfirmRestore() {
    if (!uid || !restoreTargets || restoreTargets.length === 0) return;
    Promise.all(
      restoreTargets.map((record) => unarchiveLifecycleRecord(record.recordType, record.id, uid)),
    ).catch(onWriteFailed);
    showToast(
      restoreTargets.length === 1
        ? t('lifecycle.restored', { name: restoreTargets[0].name })
        : t('lifecycle.bulkRestored', { count: restoreTargets.length }),
    );
    setRestoreTargets(null);
    setSelectedKeys(new Set());
  }

  function handleMoveToTrash(record: LifecycleRecord) {
    if (!isTrashableRecordType(record.recordType)) return;
    trashLifecycleRecord(record.recordType, record.id).catch(onWriteFailed);
    setMenuTarget(null);
    showToast(t('archive.movedToTrash', { name: record.name }));
  }

  // Categories and groups can't be trashed — silently skipped rather than
  // blocking the whole bulk action, since a mixed selection (e.g. via
  // Select all) is an expected case, not an error.
  function handleBulkMoveToTrash() {
    const trashable = selectedRecords.filter((record) => isTrashableRecordType(record.recordType));
    if (trashable.length === 0) return;
    Promise.all(
      trashable.map((record) =>
        isTrashableRecordType(record.recordType)
          ? trashLifecycleRecord(record.recordType, record.id)
          : Promise.resolve(),
      ),
    ).catch(onWriteFailed);
    showToast(t('lifecycle.bulkTrashed', { count: trashable.length }));
    setSelectedKeys(new Set());
  }

  const restoresRecurring = (restoreTargets ?? []).some((record) =>
    isRecurringDefinitionType(record.recordType),
  );

  return (
    <ScreenScroll>
      <ScreenHeader title={t('archive.title')} onBack={() => goBack('/settings')} />

      <ThemedText type="small" themeColor="textSecondary">
        {t('archive.intro')}
      </ThemedText>

      {records.length === 0 ? (
        <ThemedText type="caption">{t('archive.empty')}</ThemedText>
      ) : (
        <>
          <View style={styles.selectAll}>
            <Checkbox
              checked={allSelected}
              onValueChange={toggleSelectAll}
              accessibilityLabel={t('lifecycle.selectAll')}
            />
            <ThemedText type="small">
              {selectedKeys.size > 0
                ? t('lifecycle.selectedCount', { count: selectedKeys.size })
                : t('lifecycle.selectAll')}
            </ThemedText>
          </View>
          {selectedKeys.size > 0 && (
            <View style={styles.bulkActions}>
              <Button
                label={t('lifecycle.restoreSelected')}
                onPress={() => setRestoreTargets(selectedRecords)}
              />
              <Button
                label={t('lifecycle.trashSelected')}
                variant="secondary"
                onPress={handleBulkMoveToTrash}
              />
            </View>
          )}

          <SettingsCard>
            {records.map((record) => {
              const key = recordKey(record);
              return (
                <SettingsRow
                  key={key}
                  leading={
                    <Checkbox
                      checked={selectedKeys.has(key)}
                      onValueChange={() => toggleSelected(key)}
                      accessibilityLabel={t('lifecycle.selectRow', { name: record.name })}
                    />
                  }
                  title={record.name}
                  subtitle={`${t(TYPE_LABEL_KEY[record.recordType])} · ${t('archive.archivedOn', {
                    date: formatShortDate(record.statusDate),
                  })}`}
                  trailing={
                    <IconButton
                      name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
                      onPress={() => setMenuTarget(record)}
                      accessibilityLabel={t('common.actionsFor', { name: record.name })}
                    />
                  }
                />
              );
            })}
          </SettingsCard>
        </>
      )}

      {menuTarget && (
        <ActionSheet isOpen onClose={() => setMenuTarget(null)} title={menuTarget.name}>
          <ActionSheetItem
            icon={{ ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }}
            label={t('common.restore')}
            description={t('archive.restoreHint')}
            onPress={() => {
              setRestoreTargets([menuTarget]);
              setMenuTarget(null);
            }}
          />
          {isTrashableRecordType(menuTarget.recordType) && (
            <>
              <Divider />
              <ActionSheetItem
                icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
                label={t('archive.moveToTrash')}
                description={t('archive.moveToTrashHint', { count: trashRetentionDays })}
                tone="danger"
                onPress={() => handleMoveToTrash(menuTarget)}
              />
            </>
          )}
        </ActionSheet>
      )}

      <ConfirmRecordsSheet
        isOpen={restoreTargets !== null}
        onClose={() => setRestoreTargets(null)}
        title={t('lifecycle.confirmRestoreTitle')}
        message={t('lifecycle.confirmRestoreIntro', { count: restoreTargets?.length ?? 0 })}
        records={restoreTargets ?? []}
        footnote={restoresRecurring ? t('archive.recurringResumes') : undefined}
        confirmLabel={t('common.restore')}
        onConfirm={handleConfirmRestore}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  selectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bulkActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
