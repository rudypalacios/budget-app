import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { LineChart } from '@/components/ui/line-chart';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { sampleMonthlyTotals } from '@/constants/sample-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatCurrencyWithConversion } from '@/lib/format-currency';
import { buildPaymentRows, type PaymentRow } from '@/lib/payments-dashboard';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useUserSettingsStore } from '@/store/user-settings';

// History is a settled ledger: paid rows (real money moved) plus skipped
// rows (a recurring instance the user explicitly chose not to pay this
// period, per data-model.md §12) — both are "done" for the period, unlike
// the still-open overdue/upcoming rows the Payments screen shows.
function buildHistoryRows(rows: PaymentRow[]): PaymentRow[] {
  return [...rows]
    .filter((row) => row.paid || row.skipped)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function groupByMonth(rows: PaymentRow[], locale: string) {
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const groups = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    const key = monthFormatter.format(row.date);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }
  return groups;
}

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const rows = buildHistoryRows(buildPaymentRows(expenses, incomes));
  const groups = groupByMonth(rows, i18n.language === 'es' ? 'es' : 'en');
  const { refreshing, onRefresh } = usePullToRefresh();

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t('history.title')} />

      <Card>
        <ThemedText type="smallBold">{t('history.last6Months')}</ThemedText>
        <LineChart data={sampleMonthlyTotals} />
      </Card>

      {Array.from(groups.entries()).map(([month, monthRows]) => (
        <View key={month} style={styles.group}>
          <SectionHeader title={month} />
          <View>
            {monthRows.map((row, index) => {
              const category = categories.find((c) => c.id === row.categoryId);
              return (
                <View key={row.id}>
                  <View style={styles.row}>
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold">{row.name}</ThemedText>
                      <ThemedText type="caption">{category?.name}</ThemedText>
                      {row.skipped && <Chip label={t('history.skippedChip')} tone="warning" />}
                    </View>
                    <ThemedText
                      type="smallBold"
                      // Skipped rows stay neutral, same convention as the
                      // Payments screen — see src/app/(tabs)/index.tsx.
                      themeColor={row.skipped ? 'text' : row.direction === 'income' ? 'success' : 'danger'}
                    >
                      {row.direction === 'income' ? '+' : '-'}
                      {formatCurrencyWithConversion(
                        row.amount,
                        row.currency,
                        row.amountInDefaultCurrency,
                        defaultCurrency,
                      )}
                    </ThemedText>
                  </View>
                  {index < monthRows.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
