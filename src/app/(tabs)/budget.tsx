import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryBudgetCard } from '@/components/category-budget-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { IconButton } from '@/components/ui/icon-button';
import { MinTouchTarget, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);

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
        <View style={styles.sectionLabelRow}>
          <ThemedText type="caption">{t('budget.summary.thisMonth')}</ThemedText>
          <IconButton
            name={{ ios: 'info.circle', android: 'info', web: 'info' }}
            onPress={() => setIsInfoOpen(true)}
            accessibilityLabel={t('budget.summary.infoLabel')}
            style={styles.infoButton}
          />
        </View>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.received')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="success">
              {formatCurrency(summary.received, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.paid')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="danger">
              {formatCurrency(summary.paid, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.settledBalance')}
            </ThemedText>
            <ThemedText type="default" style={styles.resultValue} themeColor={summary.settled >= 0 ? 'success' : 'danger'}>
              {formatCurrency(summary.settled, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <ThemedText type="caption">{t('budget.summary.remaining')}</ThemedText>

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.pending')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor={summary.stillToPay > 0 ? 'danger' : 'success'}>
              {formatCurrency(summary.stillToPay, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.incomePending')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="success">
              {formatCurrency(summary.incomePending, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption" style={styles.cellLabel}>
              {t('budget.summary.projectedBalance')}
            </ThemedText>
            <ThemedText type="default" style={styles.resultValue} themeColor={summary.projected >= 0 ? 'success' : 'danger'}>
              {formatCurrency(summary.projected, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <View style={styles.footerRow}>
          <ThemedText type="caption">{t('budget.summary.overallBalance')}</ThemedText>
          <ThemedText type="default" style={styles.footerValue} themeColor={summary.overall >= 0 ? 'success' : 'danger'}>
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

      <BudgetInfoSheet isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </ScreenScroll>
  );
}

// The same four swatch colors the category bars use (Presupuesto redesign
// §5.3) — listed here ahead of phase 4 so the legend already matches them.
const LEGEND_ITEMS: { key: 'over' | 'mayExceed' | 'exact' | 'ok'; color: ThemeColor }[] = [
  { key: 'over', color: 'danger' },
  { key: 'mayExceed', color: 'warning' },
  { key: 'exact', color: 'success' },
  { key: 'ok', color: 'tint' },
];

const INFO_BLOCKS = ['settledBalance', 'pending', 'projected', 'overall'] as const;

// Explains the summary card's formulas. "Left to pay" deliberately differs
// from the Dashboard's (this month only vs. everything overdue), which is
// why the sheet offers a jump to the Dashboard rather than unifying them.
function BudgetInfoSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  function openDashboard() {
    onClose();
    router.navigate('/');
  }

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title={t('budget.info.title')}>
      {INFO_BLOCKS.map((block) => (
        <View key={block} style={styles.infoBlock}>
          <ThemedText type="smallBold">{t(`budget.info.${block}.title`)}</ThemedText>
          <ThemedText type="caption">{t(`budget.info.${block}.body`)}</ThemedText>
        </View>
      ))}

      <View style={styles.infoBlock}>
        <ThemedText type="smallBold">{t('budget.info.colors.title')}</ThemedText>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.key} style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: theme[item.color] }]} />
            <ThemedText type="caption">{t(`budget.info.colors.${item.key}`)}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.infoButtons}>
        <Button label={t('budget.info.openPanel')} variant="secondary" onPress={openDashboard} style={styles.infoButtonFlex} />
        <Button label={t('budget.info.close')} onPress={onClose} style={styles.infoButtonFlex} />
      </View>
    </ActionSheet>
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
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Keeps the full MinTouchTarget tap area while pulling the row back to the
  // caption's own height, so the icon doesn't make the card taller. The
  // negative margin lets the button's circle overflow the card's top edge,
  // so its background is cleared and only the icon shows.
  infoButton: {
    marginVertical: -(MinTouchTarget - 16) / 2,
    backgroundColor: 'transparent',
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // space-between pins each figure to the bottom of its (row-stretched)
  // cell, so figures stay aligned even when a label wraps past the two
  // lines cellLabel reserves (e.g. at large font scales).
  cell: {
    flex: 1,
    gap: Spacing.half,
    justifyContent: 'space-between',
  },
  // Reserves two caption lines so figures stay aligned across a row even
  // when one label (often in English) wraps.
  cellLabel: {
    minHeight: 32,
  },
  // Same line height as resultValue (the `default` type's 24) so the
  // bottom-pinned figures in a row share a baseline despite column 3's
  // larger font.
  figure: {
    lineHeight: 24,
  },
  resultValue: {
    fontWeight: '700',
  },
  footerValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  infoBlock: {
    gap: Spacing.one,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendSwatch: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  infoButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  infoButtonFlex: {
    flex: 1,
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
