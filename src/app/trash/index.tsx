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
  collectTrashedRecords,
  daysUntilPurge,
  isRecurringDefinitionType,
  isTrashableRecordType,
  type LifecycleRecord,
  type LifecycleRecordType,
} from '@/lib/lifecycle-records';
import { goBack } from '@/lib/navigation';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { purgeLifecycleRecord, restoreLifecycleRecord } from '@/store/lifecycle-actions';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
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

// Stage 17 — the restore/purge half of Stage 12's archive/trash engine,
// laid out per the ajustes-v2 prototype. A separate destination from the
// Archive screen, not a tab within it; categories and recurring groups
// never appear here (see TrashableRecordType). Bulk-select checkboxes +
// select-all mirror the Archive screen. Restore and permanent delete both
// go through ConfirmRecordsSheet, listing every affected record — found
// live that an unconfirmed Restore was too easy to trigger by mistake, and
// bulk selection made that worse.
//
// Writes aren't awaited (Firestore resolves them only on server ack, which
// never comes offline); a real rejection gets an error toast.
export default function TrashScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const trashRetentionDays = useUserSettingsStore((state) => state.data?.trashRetentionDays ?? 30);
  const uid = useSessionStore((state) => state.uid);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<LifecycleRecord | null>(null);
  const [restoreTargets, setRestoreTargets] = useState<LifecycleRecord[] | null>(null);
  const [purgeTargets, setPurgeTargets] = useState<LifecycleRecord[] | null>(null);

  const records = collectTrashedRecords(expenses, incomes, recurringExpenses, recurringIncomes);
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
      restoreTargets.map((record) =>
        isTrashableRecordType(record.recordType)
          ? restoreLifecycleRecord(record.recordType, record.id, uid)
          : Promise.resolve(),
      ),
    ).catch(onWriteFailed);
    showToast(
      restoreTargets.length === 1
        ? t('lifecycle.restored', { name: restoreTargets[0].name })
        : t('lifecycle.bulkRestored', { count: restoreTargets.length }),
    );
    setRestoreTargets(null);
    setSelectedKeys(new Set());
  }

  function handleConfirmPurge() {
    if (!purgeTargets || purgeTargets.length === 0) return;
    Promise.all(
      purgeTargets.map((record) =>
        isTrashableRecordType(record.recordType)
          ? purgeLifecycleRecord(record.recordType, record.id)
          : Promise.resolve(),
      ),
    ).catch(onWriteFailed);
    showToast(
      purgeTargets.length === 1
        ? t('trash.permanentlyDeleted', { name: purgeTargets[0].name })
        : t('trash.bulkPermanentlyDeleted', { count: purgeTargets.length }),
    );
    setPurgeTargets(null);
    setSelectedKeys(new Set());
  }

  const restoresRecurring = (restoreTargets ?? []).some((record) =>
    isRecurringDefinitionType(record.recordType),
  );

  return (
    <ScreenScroll>
      <ScreenHeader title={t('trash.title')} onBack={() => goBack('/settings')} />

      <ThemedText type="small" themeColor="textSecondary">
        {t('trash.intro', { count: trashRetentionDays })}
      </ThemedText>

      {records.length === 0 ? (
        <ThemedText type="caption">{t('trash.empty')}</ThemedText>
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
                label={t('trash.deleteSelectedPermanently')}
                variant="danger"
                onPress={() => setPurgeTargets(selectedRecords)}
              />
            </View>
          )}

          <SettingsCard>
            {records.map((record) => {
              const key = recordKey(record);
              const remainingDays = record.purgeAt ? daysUntilPurge(record.purgeAt) : null;
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
                  subtitle={
                    <View>
                      <ThemedText type="caption">
                        {`${t(TYPE_LABEL_KEY[record.recordType])} · ${t('trash.trashedOn', {
                          date: formatShortDate(record.statusDate),
                        })}`}
                      </ThemedText>
                      {remainingDays !== null && (
                        <ThemedText
                          type="caption"
                          themeColor={remainingDays <= 0 ? 'danger' : 'textSecondary'}
                        >
                          {remainingDays <= 0
                            ? t('trash.purgesToday')
                            : t('trash.daysUntilPurge', { count: remainingDays })}
                        </ThemedText>
                      )}
                    </View>
                  }
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
            description={t('trash.restoreHint')}
            onPress={() => {
              setRestoreTargets([menuTarget]);
              setMenuTarget(null);
            }}
          />
          <Divider />
          <ActionSheetItem
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            label={t('common.deletePermanently')}
            description={t('trash.purgeHint')}
            tone="danger"
            onPress={() => {
              setPurgeTargets([menuTarget]);
              setMenuTarget(null);
            }}
          />
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
      <ConfirmRecordsSheet
        isOpen={purgeTargets !== null}
        onClose={() => setPurgeTargets(null)}
        title={t('trash.confirmPurgeTitle')}
        message={t('trash.confirmPurgeIntro', { count: purgeTargets?.length ?? 0 })}
        records={purgeTargets ?? []}
        footnote={t('trash.cannotUndo')}
        confirmLabel={t('trash.confirmPurgeButton')}
        confirmVariant="danger"
        onConfirm={handleConfirmPurge}
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
