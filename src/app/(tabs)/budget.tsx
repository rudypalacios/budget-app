import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBudgetCard, ExpandChevron } from '@/components/category-budget-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { IconButton } from '@/components/ui/icon-button';
import { SectionHeader } from '@/components/ui/section-header';
import { MinTouchTarget, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  actualByCategory,
  attentionCount,
  categoryMovements,
  computeBudgetSummary,
  getBudgetStatus,
  normalizeMonthlyBudget,
  pendingByCategory,
  splitByBudget,
  suggestCategoryBudget,
  type BudgetCategoryRow,
} from '@/lib/budget-status';
import { getCurrentCycleRange } from '@/lib/cycle';
import { formatSignedCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import {
  recomputeStaleBudgetRecommendations,
  useRecurringExpensesStore,
} from '@/store/recurring-expenses';
import { useUserSettingsStore } from '@/store/user-settings';

export default function BudgetScreen() {
  const { t, i18n } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isNoBudgetOpen, setIsNoBudgetOpen] = useState(false);
  const theme = useTheme();

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
  const pendingTotals = pendingByCategory(expenses, cycleRange);
  const summary = computeBudgetSummary({ expenses, incomes, cycleRange });

  const activeExpenseCategories = categories.filter(
    (category) =>
      category.lifecycleState === 'active' &&
      (category.type === 'expense' || category.type === 'both'),
  );
  const activeRecurringExpenses = recurringExpenses.filter(
    (definition) => definition.lifecycleState === 'active',
  );

  // Skips categories with no activity and no budget set, to avoid clutter
  // from unused categories — a category appears once it has an explicit
  // target, paid spending, or unpaid spending due this cycle (D8: a
  // no-budget category with only pending bills used to be hidden). A budget
  // of 0 doesn't count as "budgeted" (D1, normalizeMonthlyBudget).
  const categoriesWithActivity = activeExpenseCategories.filter(
    (category) =>
      normalizeMonthlyBudget(category.monthlyBudget) !== null ||
      (actualTotals.get(category.id) ?? 0) > 0 ||
      (pendingTotals.get(category.id) ?? 0) > 0,
  );

  // Status, order and the attention count all come from budget-status.ts
  // (Presupuesto redesign §5.2/§5.4); the screen only splits and renders.
  const rows: BudgetCategoryRow[] = categoriesWithActivity.map((category) => {
    const budgeted = normalizeMonthlyBudget(category.monthlyBudget);
    const actual = actualTotals.get(category.id) ?? 0;
    const pending = pendingTotals.get(category.id) ?? 0;
    return {
      id: category.id,
      name: category.name,
      budgeted,
      actual,
      pending,
      status: getBudgetStatus({ budgeted, actual, pending }),
    };
  });
  const { withBudget, withoutBudget } = splitByBudget(rows);
  const needAttention = attentionCount(rows);
  const categoriesById = new Map(categoriesWithActivity.map((category) => [category.id, category]));

  function renderCategoryCard(row: BudgetCategoryRow) {
    const category = categoriesById.get(row.id);
    if (!category) return null;
    return (
      <CategoryBudgetCard
        key={row.id}
        category={category}
        budgeted={row.budgeted}
        actual={row.actual}
        pending={row.pending}
        status={row.status}
        defaultCurrency={defaultCurrency}
        recurringExpensesInCategory={activeRecurringExpenses.filter(
          (definition) => definition.categoryId === row.id,
        )}
        movements={categoryMovements(expenses, row.id, cycleRange)}
        suggestedBudget={suggestCategoryBudget(expenses, row.id)}
      />
    );
  }

  return (
    <ScreenScroll>
      <ScreenHeader
        title={t('budget.title')}
        subtitle={formatCycleLabel(cycleRange.start, i18n.language)}
      />

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
            <ThemedText type="caption">{t('budget.summary.received')}</ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="success">
              {formatSignedCurrency(summary.received, defaultCurrency, { showPlus: true })}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.paid')}</ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="danger">
              {formatSignedCurrency(-summary.paid, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.settledBalance')}</ThemedText>
            <ThemedText
              type="default"
              style={styles.resultValue}
              themeColor={summary.settled >= 0 ? 'success' : 'danger'}
            >
              {formatSignedCurrency(summary.settled, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <View style={styles.gridRow}>
          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.pending')}</ThemedText>
            <ThemedText
              type="smallBold"
              style={styles.figure}
              themeColor={summary.stillToPay > 0 ? 'danger' : 'success'}
            >
              {formatSignedCurrency(-summary.stillToPay, defaultCurrency)}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.incomePending')}</ThemedText>
            <ThemedText type="smallBold" style={styles.figure} themeColor="success">
              {formatSignedCurrency(summary.incomePending, defaultCurrency, { showPlus: true })}
            </ThemedText>
          </View>

          <Divider style={styles.verticalDivider} />

          <View style={styles.cell}>
            <ThemedText type="caption">{t('budget.summary.projectedBalance')}</ThemedText>
            <ThemedText
              type="default"
              style={styles.resultValue}
              themeColor={summary.projected >= 0 ? 'success' : 'danger'}
            >
              {formatSignedCurrency(summary.projected, defaultCurrency)}
            </ThemedText>
          </View>
        </View>

        <Divider style={styles.rowDivider} />

        <View style={styles.footerRow}>
          <ThemedText type="caption">{t('budget.summary.overallBalance')}</ThemedText>
          <ThemedText
            type="default"
            style={styles.footerValue}
            themeColor={summary.overall >= 0 ? 'success' : 'danger'}
          >
            {formatSignedCurrency(summary.overall, defaultCurrency)}
          </ThemedText>
        </View>
      </Card>

      <SectionHeader
        title={t('budget.categories')}
        trailingText={
          needAttention > 0 ? t('budget.attention', { count: needAttention }) : undefined
        }
      />

      {rows.length === 0 ? (
        <ThemedText type="caption">{t('budget.empty')}</ThemedText>
      ) : (
        <View style={styles.list}>
          {withBudget.map(renderCategoryCard)}

          {withoutBudget.length > 0 && (
            <>
              <Pressable
                onPress={() => setIsNoBudgetOpen((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isNoBudgetOpen }}
                style={styles.noBudgetRow}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('budget.noBudgetSection', { count: withoutBudget.length })}
                </ThemedText>
                <ExpandChevron expanded={isNoBudgetOpen} color={theme.textSecondary} />
              </Pressable>
              {isNoBudgetOpen && withoutBudget.map(renderCategoryCard)}
            </>
          )}
        </View>
      )}

      <BudgetInfoSheet isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </ScreenScroll>
  );
}

// "Septiembre 2026" / "September 2026" — the v9 subtitle. Month and year
// are formatted separately because Spanish's long form ("septiembre de
// 2026") doesn't match the design.
function formatCycleLabel(date: Date, language: string): string {
  const locale = language === 'es' ? 'es' : 'en';
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

// The same four swatch colors the category bars use (Presupuesto redesign
// §5.3) — listed here ahead of phase 4 so the legend already matches them.
const LEGEND_ITEMS: { key: 'over' | 'mayExceed' | 'exact' | 'ok'; color: ThemeColor }[] = [
  { key: 'over', color: 'danger' },
  { key: 'mayExceed', color: 'warning' },
  { key: 'exact', color: 'successFill' },
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
        <Button
          label={t('budget.info.openPanel')}
          variant="secondary"
          onPress={openDashboard}
          style={styles.infoButtonFlex}
        />
        <Button label={t('budget.info.close')} onPress={onClose} style={styles.infoButtonFlex} />
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  // v9: 10px between category cards.
  list: {
    gap: 10,
  },
  noBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MinTouchTarget,
  },
  summaryCard: {
    gap: Spacing.two,
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
  // cell, so a row's figures stay aligned whenever one label wraps —
  // which is why labels don't need a fixed two-line minHeight reserved
  // (that left a visible empty line under every single-line label).
  cell: {
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'space-between',
  },
  // Same line height as resultValue (the `default` type's 24) so the
  // bottom-pinned figures in a row share a baseline despite column 3's
  // larger font.
  // v9 sizes: 15 for plain figures, 17 for a row's result, 20 for the
  // footer — all medium weight, with tabular digits so columns line up.
  figure: {
    fontSize: 15,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  resultValue: {
    fontSize: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  footerValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
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
