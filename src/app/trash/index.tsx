import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
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

// Stage 17 — the restore/purge half of Stage 12's archive/trash engine.
// A separate destination from the Archive screen (src/app/archive/index.tsx),
// not a tab/filter within it. Categories never appear here — they have no
// trashed state at all (see lifecycle-records.ts).
export default function TrashScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const uid = useSessionStore((state) => state.uid);
  const [purgeTarget, setPurgeTarget] = useState<LifecycleRecord | null>(null);

  const records = collectTrashedRecords(expenses, incomes, recurringExpenses, recurringIncomes);

  async function handleRestore(recordType: LifecycleRecordType, id: string, name: string) {
    if (!uid) return;
    await restoreLifecycleRecord(recordType, id, uid);
    showToast(t('lifecycle.restored', { name }));
  }

  async function handleConfirmPurge() {
    if (!purgeTarget) return;
    await purgeLifecycleRecord(purgeTarget.recordType as TrashableType, purgeTarget.id);
    showToast(t('trash.permanentlyDeleted', { name: purgeTarget.name }));
    setPurgeTarget(null);
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('trash.title')} onBack={() => goBack('/settings')} />

      {records.length === 0 ? (
        <ThemedText type="caption">{t('trash.empty')}</ThemedText>
      ) : (
        <Card style={styles.card}>
          {records.map((record, index) => {
            const type = record.recordType as TrashableType;
            const remainingDays = record.purgeAt ? daysUntilPurge(record.purgeAt) : null;
            return (
              <View key={`${record.recordType}-${record.id}`}>
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <ThemedText type="smallBold">{record.name}</ThemedText>
                    <View style={styles.rowMeta}>
                      <Chip label={t(TYPE_LABEL_KEY[type])} />
                      <ThemedText type="caption">
                        {t('trash.trashedOn', { date: formatShortDate(record.statusDate) })}
                      </ThemedText>
                    </View>
                    {remainingDays !== null && (
                      <ThemedText type="caption" themeColor={remainingDays <= 0 ? 'danger' : 'textSecondary'}>
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
                        onPress: () => handleRestore(record.recordType, record.id, record.name),
                      },
                      {
                        label: t('common.deletePermanently'),
                        onPress: () => setPurgeTarget(record),
                      },
                    ]}
                  />
                </View>
                {index < records.length - 1 && <Divider style={styles.divider} />}
              </View>
            );
          })}
        </Card>
      )}

      <Dialog
        isOpen={purgeTarget !== null}
        onClose={() => setPurgeTarget(null)}
        title={t('trash.confirmPurgeTitle')}
      >
        <ThemedText>{t('trash.confirmPurgeMessage', { name: purgeTarget?.name ?? '' })}</ThemedText>
        <View style={styles.dialogActions}>
          <Button
            label={t('trash.confirmPurgeButton')}
            variant="danger"
            onPress={handleConfirmPurge}
            style={styles.dialogButton}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => setPurgeTarget(null)}
            style={styles.dialogButton}
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
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
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
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogButton: {
    flex: 1,
  },
});
