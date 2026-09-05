import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryBudgetCard } from '@/components/category-budget-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { FormRowBreakpoint, Spacing } from '@/constants/theme';
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
  const { width } = useWindowDimensions();
  const isNarrow = width < FormRowBreakpoint;

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

  // Total realistic spend across every active category, not just ones with a
  // budget set — the point is seeing total actual spend versus what's
  // expected, not silently excluding categories the user hasn't budgeted yet.
  const totalActual = expenses
    .filter((expense) => expense.paid && expense.lifecycleState === 'active' && isWithinCycle(expense.paidDate!.toDate(), cycleRange))
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);

  // FR-6/income relation: money actually received this month, not expected/
  // upcoming income — answers "do I literally have this much right now,"
  // which is what "already on red numbers" is really asking.
  const totalIncomeReceived = incomes
    .filter((income) => income.paid && income.lifecycleState === 'active' && isWithinCycle(income.paidDate!.toDate(), cycleRange))
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);
  const netCashPosition = totalIncomeReceived - totalActual;

  // All-time, no cycle filter — the closest thing to a real balance the app
  // can derive without a dedicated starting-balance field.
  const allTimeIncomeReceived = incomes
    .filter((income) => income.paid && income.lifecycleState === 'active')
    .reduce((sum, income) => sum + income.amountInDefaultCurrency, 0);
  const allTimeExpensesPaid = expenses
    .filter((expense) => expense.paid && expense.lifecycleState === 'active')
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  const allTimeBalance = allTimeIncomeReceived - allTimeExpensesPaid;

  // Unpaid, non-skipped expenses due within the current calendar month —
  // scoped by due date (`date`), not `paidDate` (unpaid records have none
  // yet) — matches this screen's existing this-month-only convention rather
  // than the Payments Dashboard's all-time "pending" definition.
  const stillToPayThisMonth = expenses
    .filter(
      (expense) =>
        !expense.paid &&
        !(expense.kind === 'recurringInstance' && expense.skipped) &&
        expense.lifecycleState === 'active' &&
        isWithinCycle(expense.date.toDate(), cycleRange),
    )
    .reduce((sum, expense) => sum + expense.amountInDefaultCurrency, 0);
  const projectedLeftAfterBills = netCashPosition - stillToPayThisMonth;

  return (
    <ScreenScroll>
      <ScreenHeader title={t('budget.title')} />

      <View style={[styles.summaryRow, isNarrow && styles.summaryRowNarrow]}>
        <Card style={styles.summaryCard}>
          <ThemedText type="caption">{t('budget.balance.title')}</ThemedText>
          <ThemedText type="title" themeColor={allTimeBalance >= 0 ? 'success' : 'danger'}>
            {formatCurrency(allTimeBalance, defaultCurrency)}
          </ThemedText>
        </Card>

        <Card style={styles.summaryCard}>
          <ThemedText type="caption">{t('budget.thisMonth.title')}</ThemedText>
          <View style={styles.incomeRow}>
            <ThemedText type="smallBold" themeColor="success">
              {t('budget.thisMonth.received', { amount: formatCurrency(totalIncomeReceived, defaultCurrency) })}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="danger">
              {t('budget.thisMonth.spent', { amount: formatCurrency(totalActual, defaultCurrency) })}
            </ThemedText>
          </View>
          <ThemedText type="title" themeColor={netCashPosition >= 0 ? 'success' : 'danger'}>
            {netCashPosition >= 0
              ? t('budget.thisMonth.leftToSpend', { amount: formatCurrency(netCashPosition, defaultCurrency) })
              : t('budget.thisMonth.overspent', { amount: formatCurrency(Math.abs(netCashPosition), defaultCurrency) })}
          </ThemedText>
        </Card>

        <Card style={styles.summaryCard}>
          <ThemedText type="caption">{t('budget.stillToPay.title')}</ThemedText>
          <ThemedText type="title" themeColor={stillToPayThisMonth > 0 ? 'danger' : 'success'}>
            {formatCurrency(stillToPayThisMonth, defaultCurrency)}
          </ThemedText>
          <ThemedText type="smallBold" themeColor={projectedLeftAfterBills >= 0 ? 'success' : 'danger'}>
            {projectedLeftAfterBills >= 0
              ? t('budget.stillToPay.leftAfter', { amount: formatCurrency(projectedLeftAfterBills, defaultCurrency) })
              : t('budget.stillToPay.shortAfter', {
                  amount: formatCurrency(Math.abs(projectedLeftAfterBills), defaultCurrency),
                })}
          </ThemedText>
        </Card>
      </View>

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
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryRowNarrow: {
    flexDirection: 'column',
  },
  summaryCard: {
    flex: 1,
    gap: Spacing.two,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
