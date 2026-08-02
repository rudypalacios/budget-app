import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryBudgetCard } from '@/components/category-budget-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { getCurrentCycleRange, isWithinCycle } from '@/lib/cycle';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { recomputeStaleBudgetRecommendations, useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useUserSettingsStore } from '@/store/user-settings';

export default function BudgetScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  // Same reason as the Expenses tab's identical effect: catches drift missed
  // by a stale cache (data-model.md §9) whenever this screen — which also
  // surfaces recommendations, via each category's breakdown — is viewed.
  useEffect(() => {
    recomputeStaleBudgetRecommendations();
  }, []);

  // Keyed by paidDate, not date — matches the same established convention
  // as payments-dashboard.ts's groupPaymentRows ("a payment settled today
  // for a 3-month-old bill belongs to *this* cycle, not the cycle it was
  // originally due in").
  const cycleRange = getCurrentCycleRange();

  // Sums each record's amountInDefaultCurrency (not the raw, possibly
  // foreign-currency amount) — records in the same category can carry
  // different currencies (FR-15/FR-18), so summing raw `amount` would mix
  // currencies together. Includes one-time expenses alongside recurring
  // instances (FR-6) — a category's real spend isn't just what its recurring
  // bills say it should be. Scoped to the current month (paidDate is
  // guaranteed non-null once paid is true) so "this month" totals actually
  // mean that, rather than an all-time sum.
  function actualForCategory(categoryId: string) {
    return expenses
      .filter(
        (expense) =>
          expense.categoryId === categoryId &&
          expense.paid &&
          expense.lifecycleState === 'active' &&
          isWithinCycle(expense.paidDate!.toDate(), cycleRange),
      )
      .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  }

  const activeExpenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );
  const activeRecurringExpenses = recurringExpenses.filter((definition) => definition.lifecycleState === 'active');

  // Skips categories with no activity and no budget set, to avoid clutter
  // from unused categories — a category only needs to appear once it's
  // either being spent in or has an explicit target.
  // != null (not !== null) deliberately catches both null and undefined —
  // a category document created before Stage 13 has no monthlyBudget field
  // at all, which reads back as undefined rather than null.
  const categoriesWithActivity = activeExpenseCategories.filter(
    (category) => category.monthlyBudget != null || actualForCategory(category.id) > 0,
  );

  const totalBudgeted = categoriesWithActivity.reduce((sum, category) => sum + (category.monthlyBudget ?? 0), 0);
  // Total realistic spend across every active category, not just ones with a
  // budget set — the point is seeing total actual spend versus what's
  // expected, not silently excluding categories the user hasn't budgeted yet.
  const totalActual = expenses
    .filter((expense) => expense.paid && expense.lifecycleState === 'active' && isWithinCycle(expense.paidDate!.toDate(), cycleRange))
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  const remaining = totalBudgeted - totalActual;

  // FR-6/income relation: money actually received this month, not expected/
  // upcoming income — answers "do I literally have this much right now,"
  // which is what "already on red numbers" is really asking.
  const totalIncomeReceived = incomes
    .filter((income) => income.paid && income.lifecycleState === 'active' && isWithinCycle(income.paidDate!.toDate(), cycleRange))
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);
  const netCashPosition = totalIncomeReceived - totalActual;

  return (
    <ScreenScroll>
      <ScreenHeader title={t('budget.title')} />

      <Card>
        <ThemedText type="caption">{t('budget.budgetedThisMonth')}</ThemedText>
        <ThemedText type="title">{formatCurrency(totalBudgeted, defaultCurrency)}</ThemedText>
        <ThemedText type="smallBold" themeColor={remaining >= 0 ? 'success' : 'danger'}>
          {formatCurrency(Math.abs(remaining), defaultCurrency)}{' '}
          {remaining >= 0 ? t('budget.remaining') : t('budget.overBudget')}
        </ThemedText>
      </Card>

      <Card style={styles.incomeCard}>
        <ThemedText type="caption">{t('budget.income.title')}</ThemedText>
        <View style={styles.incomeRow}>
          <ThemedText type="smallBold" themeColor="success">
            {t('budget.income.received', { amount: formatCurrency(totalIncomeReceived, defaultCurrency) })}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="danger">
            {t('budget.income.spent', { amount: formatCurrency(totalActual, defaultCurrency) })}
          </ThemedText>
        </View>
        <ThemedText type="title" themeColor={netCashPosition >= 0 ? 'success' : 'danger'}>
          {netCashPosition >= 0
            ? t('budget.income.leftToSpend', { amount: formatCurrency(netCashPosition, defaultCurrency) })
            : t('budget.income.overspent', { amount: formatCurrency(Math.abs(netCashPosition), defaultCurrency) })}
        </ThemedText>
      </Card>

      <View style={styles.list}>
        {categoriesWithActivity.map((category) => (
          <CategoryBudgetCard
            key={category.id}
            category={category}
            actual={actualForCategory(category.id)}
            defaultCurrency={defaultCurrency}
            recurringExpensesInCategory={activeRecurringExpenses.filter(
              (definition) => definition.categoryId === category.id,
            )}
          />
        ))}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  incomeCard: {
    gap: Spacing.two,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
