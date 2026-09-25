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
import { ConfirmRecordsDialog } from '@/components/ui/confirm-records-dialog';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { Spacing } from '@/constants/theme';
import { formatShortDate } from '@/lib/format-date';
import {
  collectTrashedRecords,
  daysUntilPurge,
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

type TrashableType = Exclude<LifecycleRecordType, 'category'>;

const TYPE_LABEL_KEY: Record<TrashableType, string> = {
  expense: 'lifecycle.type.expense',
  income: 'lifecycle.type.income',
  recurringExpense: 'lifecycle.type.recurringExpense',
  recurringIncome: 'lifecycle.type.recurringIncome',
};

function recordKey(record: Pick<LifecycleRecord, 'recordType' | 'id'>): string {
  return `${record.recordType}-${record.id}`;
}

// Stage 17 — the restore/purge half of Stage 12's archive/trash engine.
// A separate destination from the Archive screen (src/app/archive/index.tsx),
// not a tab/filter within it. Categories never appear here — they have no
// trashed state at all (see lifecycle-records.ts). Bulk-select checkboxes +
// select-all mirror the same pattern on both this screen and Archive.
// Restore and permanent-delete both go through ConfirmRecordsDialog
// (src/components/ui/confirm-records-dialog.tsx), listing every affected
// record — found live that an unconfirmed Restore was too easy to trigger
// by mistake, and bulk selection made that worse (one click, many records).
export default function TrashScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const uid = useSessionStore((state) => state.uid);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [restoreTargets, setRestoreTargets] = useState<LifecycleRecord[] | null>(null);
  const [purgeTargets, setPurgeTargets] = useState<LifecycleRecord[] | null>(null);

  const records = collectTrashedRecords(expenses, incomes, recurringExpenses, recurringIncomes);
  const allSelected = records.length > 0 && selectedKeys.size === records.length;
  const selectedRecords = records.filter((record) => selectedKeys.has(recordKey(record)));

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

  async function handleConfirmRestore() {
    if (!uid || !restoreTargets || restoreTargets.length === 0) return;
    await Promise.all(
      restoreTargets.map((record) => restoreLifecycleRecord(record.recordType, record.id, uid)),
    );
    showToast(
      restoreTargets.length === 1
        ? t('lifecycle.restored', { name: restoreTargets[0].name })
        : t('lifecycle.bulkRestored', { count: restoreTargets.length }),
    );
    setRestoreTargets(null);
    setSelectedKeys(new Set());
  }

  async function handleConfirmPurge() {
    if (!purgeTargets || purgeTargets.length === 0) return;
    await Promise.all(
      purgeTargets.map((target) =>
        purgeLifecycleRecord(target.recordType as TrashableType, target.id),
      ),
    );
    showToast(
      purgeTargets.length === 1
        ? t('trash.permanentlyDeleted', { name: purgeTargets[0].name })
        : t('trash.bulkPermanentlyDeleted', { count: purgeTargets.length }),
    );
    setPurgeTargets(null);
    setSelectedKeys(new Set());
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('trash.title')} onBack={() => goBack('/settings')} />

      {records.length === 0 ? (
        <ThemedText type="caption">{t('trash.empty')}</ThemedText>
      ) : (
        <>
          <View style={styles.bulkBar}>
            <Checkbox
              checked={allSelected}
              onValueChange={toggleSelectAll}
              accessibilityLabel={t('lifecycle.selectAll')}
            />
            <ThemedText type="caption">
              {selectedKeys.size > 0
                ? t('lifecycle.selectedCount', { count: selectedKeys.size })
                : t('lifecycle.selectAll')}
            </ThemedText>
            {selectedKeys.size > 0 && (
              <View style={styles.bulkActions}>
                <Button
                  label={t('lifecycle.restoreSelected')}
                  variant="secondary"
                  onPress={() => setRestoreTargets(selectedRecords)}
                />
                <Button
                  label={t('trash.deleteSelectedPermanently')}
                  variant="danger"
                  onPress={() => setPurgeTargets(selectedRecords)}
                />
              </View>
            )}
          </View>

          <Card style={styles.card}>
            {records.map((record, index) => {
              const type = record.recordType as TrashableType;
              const key = recordKey(record);
              const isSelected = selectedKeys.has(key);
              const remainingDays = record.purgeAt ? daysUntilPurge(record.purgeAt) : null;
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
                        <Chip label={t(TYPE_LABEL_KEY[type])} />
                        <ThemedText type="caption">
                          {t('trash.trashedOn', { date: formatShortDate(record.statusDate) })}
                        </ThemedText>
                      </View>
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
                    <OverflowMenu
                      accessibilityLabel={t('common.actionsFor', { name: record.name })}
                      items={[
                        {
                          label: t('common.restore'),
                          onPress: () => setRestoreTargets([record]),
                        },
                        {
                          label: t('common.deletePermanently'),
                          onPress: () => setPurgeTargets([record]),
                        },
                      ]}
                    />
                  </View>
                  {index < records.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        </>
      )}

      <ConfirmRecordsDialog
        isOpen={restoreTargets !== null}
        onClose={() => setRestoreTargets(null)}
        title={t('lifecycle.confirmRestoreTitle')}
        message={t('lifecycle.confirmRestoreIntro', { count: restoreTargets?.length ?? 0 })}
        records={restoreTargets ?? []}
        confirmLabel={t('common.restore')}
        onConfirm={handleConfirmRestore}
      />

      <ConfirmRecordsDialog
        isOpen={purgeTargets !== null}
        onClose={() => setPurgeTargets(null)}
        title={t('trash.confirmPurgeTitle')}
        message={t('trash.confirmPurgeIntro', { count: purgeTargets?.length ?? 0 })}
        records={purgeTargets ?? []}
        confirmLabel={t('trash.confirmPurgeButton')}
        confirmVariant="danger"
        onConfirm={handleConfirmPurge}
      />
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
