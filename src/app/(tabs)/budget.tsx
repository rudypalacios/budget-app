import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryBudgetCard } from '@/components/category-budget-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Spacing } from '@/constants/theme';
import { actualByCategory, computeBudgetSummary, normalizeMonthlyBudget } from '@/lib/budget-status';
import { getCurrentCycleRange } from '@/lib/cycle';
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
  const actualTotals = actualByCategory(expenses, cycleRange);
  const summary = computeBudgetSummary({ expenses, incomes, cycleRange });

  const activeExpenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );
  const activeRecurringExpenses = recurringExpenses.filter((definition) => definition.lifecycleState === 'active');

  // Skips categories with no activity and no budget set, to avoid clutter
  // from unused categories — a category only needs to appear once it's
  // either being spent in or has an explicit target. A budget of 0 no
  // longer counts as "budgeted" here (D1, normalizeMonthlyBudget).
  const categoriesWithActivity = activeExpenseCategories.filter(
    (category) => normalizeMonthlyBudget(category.monthlyBudget) !== null || (actualTotals.get(category.id) ?? 0) > 0,
  );

  return (
    <ScreenScroll>
      <ScreenHeader title={t('budget.title')} />

      <Card style={styles.summaryCard}>
        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.received')}</ThemedText>
            <ThemedText type="smallBold" themeColor="success">
              {formatCurrency(summary.received, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.paid')}</ThemedText>
            <ThemedText type="smallBold" themeColor="danger">
              {formatCurrency(summary.paid, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.settledBalance')}</ThemedText>
            <ThemedText type="smallBold" themeColor={summary.settled >= 0 ? 'success' : 'danger'}>
              {formatCurrency(summary.settled, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.pending')}</ThemedText>
            <ThemedText type="smallBold" themeColor={summary.stillToPay > 0 ? 'danger' : 'success'}>
              {formatCurrency(summary.stillToPay, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.incomePending')}</ThemedText>
            <ThemedText type="smallBold" themeColor="success">
              {formatCurrency(summary.incomePending, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.projectedBalance')}</ThemedText>
            <ThemedText type="smallBold" themeColor={summary.projected >= 0 ? 'success' : 'danger'}>
              {formatCurrency(summary.projected, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <View style={styles.footerRow}>
          <ThemedText type="caption">{t('budget.summary.overallBalance')}</ThemedText>
          <ThemedText type="subtitle" themeColor={summary.overall >= 0 ? 'success' : 'danger'}>
            {formatCurrency(summary.overall, defaultCurrency)}
          </ThemedText>
        </View>
      </Card>

      <View style={styles.list}>
        {categoriesWithActivity.map((category) => (
          <CategoryBudgetCard
            key={category.id}
            category={category}
            actual={actualTotals.get(category.id) ?? 0}
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
  summaryCard: {
    gap: Spacing.two,
    padding: Spacing.two,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cell: {
    flex: 1,
    gap: Spacing.half,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
  },
  rowDivider: {
    marginVertical: Spacing.one,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
