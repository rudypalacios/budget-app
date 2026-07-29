import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import { sampleBudgets } from '@/constants/sample-data';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';

export default function BudgetScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);

  function actualForCategory(categoryId: string) {
    return expenses
      .filter((expense) => expense.categoryId === categoryId && expense.paid)
      .reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
  }

  const totalBudgeted = sampleBudgets.reduce((sum, line) => sum + line.budgeted, 0);
  const totalActual = sampleBudgets.reduce(
    (sum, line) => sum + actualForCategory(line.categoryId),
    0,
  );
  const remaining = totalBudgeted - totalActual;

  return (
    <ScreenScroll>
      <ScreenHeader title={t('budget.title')} />

      <Card>
        <ThemedText type="caption">{t('budget.budgetedThisMonth')}</ThemedText>
        <ThemedText type="title">{formatCurrency(totalBudgeted, 'GTQ')}</ThemedText>
        <ThemedText type="smallBold" themeColor={remaining >= 0 ? 'success' : 'danger'}>
          {formatCurrency(Math.abs(remaining), 'GTQ')}{' '}
          {remaining >= 0 ? t('budget.remaining') : t('budget.overBudget')}
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
                {isOverBudget && <Chip label={t('budget.overBudgetChip')} tone="danger" />}
              </View>
              <ProgressBar budgeted={line.budgeted} actual={actual} />
              <View style={styles.categoryFooter}>
                <ThemedText type="caption">
                  {t('budget.spent', { amount: formatCurrency(actual, 'GTQ') })}
                </ThemedText>
                <ThemedText type="caption">
                  {t('budget.ofBudgeted', { amount: formatCurrency(line.budgeted, 'GTQ') })}
                </ThemedText>
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
