import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { Spacing } from '@/constants/theme';
import { formatShortDate } from '@/lib/format-date';
import { collectArchivedRecords, type LifecycleRecord, type LifecycleRecordType } from '@/lib/lifecycle-records';
import { goBack } from '@/lib/navigation';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { restoreLifecycleRecord, trashLifecycleRecord } from '@/store/lifecycle-actions';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { showToast } from '@/store/toast';

const TYPE_LABEL_KEY: Record<LifecycleRecordType, string> = {
  expense: 'lifecycle.type.expense',
  income: 'lifecycle.type.income',
  recurringExpense: 'lifecycle.type.recurringExpense',
  recurringIncome: 'lifecycle.type.recurringIncome',
  category: 'lifecycle.type.category',
};

function recordKey(record: Pick<LifecycleRecord, 'recordType' | 'id'>): string {
  return `${record.recordType}-${record.id}`;
}

// Stage 17 — the browse/restore half of Stage 12's archive/trash engine.
// One flat list across every archivable type (expenses, income, recurring
// definitions, categories), sorted newest-archived-first, with a type chip
// per row for organization — a separate destination from the Trash screen
// (src/app/trash/index.tsx), not a tab/filter within it, per the user's
// explicit Gmail-style-mailboxes direction during planning. Bulk-select
// checkboxes + select-all (feedback round after the initial build) mirror
// the same pattern on both this screen and Trash.
export default function ArchiveScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const uid = useSessionStore((state) => state.uid);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const records = collectArchivedRecords(expenses, incomes, recurringExpenses, recurringIncomes, categories);
  const allSelected = records.length > 0 && selectedKeys.size === records.length;

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

  async function handleRestore(recordType: LifecycleRecordType, id: string, name: string) {
    if (!uid) return;
    await restoreLifecycleRecord(recordType, id, uid);
    showToast(t('lifecycle.restored', { name }));
  }

  async function handleMoveToTrash(recordType: Exclude<LifecycleRecordType, 'category'>, id: string, name: string) {
    await trashLifecycleRecord(recordType, id);
    showToast(t('archive.movedToTrash', { name }));
  }

  const selectedRecords = records.filter((record) => selectedKeys.has(recordKey(record)));

  async function handleBulkRestore() {
    if (!uid || selectedRecords.length === 0) return;
    await Promise.all(selectedRecords.map((record) => restoreLifecycleRecord(record.recordType, record.id, uid)));
    showToast(t('lifecycle.bulkRestored', { count: selectedRecords.length }));
    setSelectedKeys(new Set());
  }

  // Categories can't be trashed (see lifecycle-actions.ts) — silently
  // skipped rather than blocking the whole bulk action, since a mixed
  // selection (e.g. via Select all) is an expected case, not an error.
  async function handleBulkMoveToTrash() {
    const trashable = selectedRecords.filter((record) => record.recordType !== 'category');
    if (trashable.length === 0) return;
    await Promise.all(
      trashable.map((record) => trashLifecycleRecord(record.recordType as Exclude<LifecycleRecordType, 'category'>, record.id)),
    );
    showToast(t('lifecycle.bulkTrashed', { count: trashable.length }));
    setSelectedKeys(new Set());
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('archive.title')} onBack={() => goBack('/settings')} />

      {records.length === 0 ? (
        <ThemedText type="caption">{t('archive.empty')}</ThemedText>
      ) : (
        <>
          <View style={styles.bulkBar}>
            <Checkbox checked={allSelected} onValueChange={toggleSelectAll} accessibilityLabel={t('lifecycle.selectAll')} />
            <ThemedText type="caption">
              {selectedKeys.size > 0 ? t('lifecycle.selectedCount', { count: selectedKeys.size }) : t('lifecycle.selectAll')}
            </ThemedText>
            {selectedKeys.size > 0 && (
              <View style={styles.bulkActions}>
                <Button label={t('lifecycle.restoreSelected')} variant="secondary" onPress={handleBulkRestore} />
                <Button label={t('lifecycle.trashSelected')} variant="secondary" onPress={handleBulkMoveToTrash} />
              </View>
            )}
          </View>

          <Card style={styles.card}>
            {records.map((record, index) => {
              const key = recordKey(record);
              const isSelected = selectedKeys.has(key);
              const menuItems = [
                { label: t('common.restore'), onPress: () => handleRestore(record.recordType, record.id, record.name) },
                ...(record.recordType === 'category'
                  ? []
                  : [
                      {
                        label: t('common.delete'),
                        onPress: () =>
                          handleMoveToTrash(record.recordType as Exclude<LifecycleRecordType, 'category'>, record.id, record.name),
                      },
                    ]),
              ];

              return (
                <View key={key}>
                  <View style={styles.row}>
                    <Checkbox
                      checked={isSelected}
                      onValueChange={() => toggleSelected(key)}
                      accessibilityLabel={t('lifecycle.selectRow', { name: record.name })}
                    />
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold">{record.name}</ThemedText>
                      <View style={styles.rowMeta}>
                        <Chip label={t(TYPE_LABEL_KEY[record.recordType])} />
                        <ThemedText type="caption">
                          {t('archive.archivedOn', { date: formatShortDate(record.statusDate) })}
                        </ThemedText>
                      </View>
                    </View>
                    <OverflowMenu accessibilityLabel={t('common.actionsFor', { name: record.name })} items={menuItems} />
                  </View>
                  {index < records.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  bulkBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bulkActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
