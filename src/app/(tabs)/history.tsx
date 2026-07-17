import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { LineChart } from '@/components/ui/line-chart';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { sampleMonthlyTotals } from '@/constants/sample-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatCurrency } from '@/lib/format-currency';
import type { WithId } from '@/lib/firebase/firestore.types';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import type { Category, ExpenseRecord, IncomeRecord } from '@/types/firestore';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

type HistoryRow = {
  id: string;
  name: string;
  categoryName: string | undefined;
  amount: number;
  currency: string;
  date: Date;
  direction: 'expense' | 'income';
};

function buildHistoryRows(
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
  categories: WithId<Category>[],
): HistoryRow[] {
  const expenseRows: HistoryRow[] = expenses
    .filter((expense) => expense.paid)
    .map((expense) => ({
      id: expense.id,
      name: expense.name,
      categoryName: categories.find((c) => c.id === expense.categoryId)?.name,
      // amount is only null for an unpaid RecurringExpenseInstance
      // (data-model.md §6) — filtered out by `paid` above already.
      amount: expense.amount ?? 0,
      currency: expense.currency,
      date: expense.date.toDate(),
      direction: 'expense',
    }));

  const incomeRows: HistoryRow[] = incomes
    .filter((income) => income.paid)
    .map((income) => ({
      id: income.id,
      name: income.name,
      categoryName: categories.find((c) => c.id === income.categoryId)?.name,
      amount: income.amount,
      currency: income.currency,
      date: income.date.toDate(),
      direction: 'income',
    }));

  return [...expenseRows, ...incomeRows].sort((a, b) => b.date.getTime() - a.date.getTime());
}

function groupByMonth(rows: HistoryRow[]) {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = MONTH_FORMATTER.format(row.date);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }
  return groups;
}

export default function HistoryScreen() {
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const rows = buildHistoryRows(expenses, incomes, categories);
  const groups = groupByMonth(rows);
  const { refreshing, onRefresh } = usePullToRefresh();

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="History" />

      <Card>
        <ThemedText type="smallBold">Last 6 months</ThemedText>
        <LineChart data={sampleMonthlyTotals} />
      </Card>

      {Array.from(groups.entries()).map(([month, monthRows]) => (
        <View key={month} style={styles.group}>
          <SectionHeader title={month} />
          <View>
            {monthRows.map((row, index) => (
              <View key={row.id}>
                <View style={styles.row}>
                  <View>
                    <ThemedText type="smallBold">{row.name}</ThemedText>
                    <ThemedText type="caption">{row.categoryName}</ThemedText>
                  </View>
                  <ThemedText
                    type="smallBold"
                    themeColor={row.direction === 'income' ? 'success' : 'danger'}
                  >
                    {row.direction === 'income' ? '+' : '-'}
                    {formatCurrency(row.amount, row.currency)}
                  </ThemedText>
                </View>
                {index < monthRows.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))}
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
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
