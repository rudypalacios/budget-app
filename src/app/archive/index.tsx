import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { Spacing } from '@/constants/theme';
import { formatShortDate } from '@/lib/format-date';
import { collectArchivedRecords, type LifecycleRecordType } from '@/lib/lifecycle-records';
import { goBack } from '@/lib/navigation';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { restoreLifecycleRecord } from '@/store/lifecycle-actions';
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

// Stage 17 — the browse/restore half of Stage 12's archive/trash engine.
// One flat list across every archivable type (expenses, income, recurring
// definitions, categories), sorted newest-archived-first, with a type chip
// per row for organization — a separate destination from the Trash screen
// (src/app/trash/index.tsx), not a tab/filter within it, per the user's
// explicit Gmail-style-mailboxes direction during planning.
export default function ArchiveScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const uid = useSessionStore((state) => state.uid);

  const records = collectArchivedRecords(expenses, incomes, recurringExpenses, recurringIncomes, categories);

  async function handleRestore(recordType: LifecycleRecordType, id: string, name: string) {
    if (!uid) return;
    await restoreLifecycleRecord(recordType, id, uid);
    showToast(t('lifecycle.restored', { name }));
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('archive.title')} onBack={() => goBack('/settings')} />

      {records.length === 0 ? (
        <ThemedText type="caption">{t('archive.empty')}</ThemedText>
      ) : (
        <Card style={styles.card}>
          {records.map((record, index) => (
            <View key={`${record.recordType}-${record.id}`}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{record.name}</ThemedText>
                  <View style={styles.rowMeta}>
                    <Chip label={t(TYPE_LABEL_KEY[record.recordType])} />
                    <ThemedText type="caption">
                      {t('archive.archivedOn', { date: formatShortDate(record.statusDate) })}
                    </ThemedText>
                  </View>
                </View>
                <Button
                  label={t('common.restore')}
                  variant="secondary"
                  onPress={() => handleRestore(record.recordType, record.id, record.name)}
                />
              </View>
              {index < records.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </Card>
      )}
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
});
