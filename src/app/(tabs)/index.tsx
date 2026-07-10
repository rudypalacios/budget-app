import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import { sampleBudgets } from '@/constants/sample-data';
import { categoriesStore, expensesStore } from '@/lib/mock-stores';
import { formatCurrency } from '@/lib/format-currency';

export default function BudgetScreen() {
  const { items: expenses } = expensesStore.useStore();
  const { items: categories } = categoriesStore.useStore();

  function actualForCategory(categoryId: string) {
    return expenses
      .filter((expense) => expense.categoryId === categoryId && expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  const totalBudgeted = sampleBudgets.reduce((sum, line) => sum + line.budgeted, 0);
  const totalActual = sampleBudgets.reduce(
    (sum, line) => sum + actualForCategory(line.categoryId),
    0,
  );
  const remaining = totalBudgeted - totalActual;

  return (
    <ScreenScroll>
      <ScreenHeader title="Budget" />

      <Card>
        <ThemedText type="caption">Budgeted this month</ThemedText>
        <ThemedText type="title">{formatCurrency(totalBudgeted, 'GTQ')}</ThemedText>
        <ThemedText type="smallBold" themeColor={remaining >= 0 ? 'success' : 'danger'}>
          {formatCurrency(Math.abs(remaining), 'GTQ')}{' '}
          {remaining >= 0 ? 'remaining' : 'over budget'}
        </ThemedText>
      </Card>

      <View style={styles.list}>
        {sampleBudgets.map((line) => {
          const category = categories.find((c) => c.id === line.categoryId);
          const actual = actualForCategory(line.categoryId);
          const isOverBudget = actual > line.budgeted;

          return (
            <Card key={line.categoryId} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <ThemedText type="smallBold">{category?.name}</ThemedText>
                {isOverBudget && <Chip label="Over budget" tone="danger" />}
              </View>
              <ProgressBar budgeted={line.budgeted} actual={actual} />
              <View style={styles.categoryFooter}>
                <ThemedText type="caption">{formatCurrency(actual, 'GTQ')} spent</ThemedText>
                <ThemedText type="caption">of {formatCurrency(line.budgeted, 'GTQ')}</ThemedText>
              </View>
            </Card>
          );
        })}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  categoryCard: {
    gap: Spacing.two,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
