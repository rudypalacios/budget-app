import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetRecommendationBadge } from '@/components/budget-recommendation-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { budgetPercent, projectedTotal, type BudgetStatus } from '@/lib/budget-status';
import { categoryDisplayName } from '@/lib/category-display';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import type { Category, CurrencyCode, RecurringExpense } from '@/types/firestore';

export type CategoryBudgetCardProps = {
  category: WithId<Category>;
  // All figures come precomputed from budget-status.ts (Presupuesto
  // redesign §5) — this card only presents them, it never re-derives status.
  budgeted: number | null; // already normalized: 0/blank means null
  actual: number;
  pending: number;
  status: BudgetStatus;
  defaultCurrency: CurrencyCode;
  // Active recurring expenses in this category — the per-bill breakdown
  // (Stage 13 user feedback: a single category total can hide which
  // specific bill actually changed, e.g. "Services" masking that only
  // Electrical drifted). Summary by default; this only renders once expanded.
  recurringExpensesInCategory: WithId<RecurringExpense>[];
};

const STATUS_CHIP: Partial<Record<BudgetStatus, { labelKey: string; tone: 'danger' | 'warning' }>> = {
  over: { labelKey: 'budget.overBudgetChip', tone: 'danger' },
  mayExceed: { labelKey: 'budget.mayExceedChip', tone: 'warning' },
};

const A11Y_STATUS_KEY: Partial<Record<BudgetStatus, string>> = {
  over: 'budget.a11y.statusOver',
  mayExceed: 'budget.a11y.statusMayExceed',
  exact: 'budget.a11y.statusExact',
};

export function CategoryBudgetCard({
  category,
  budgeted,
  actual,
  pending,
  status,
  defaultCurrency,
  recurringExpensesInCategory,
}: CategoryBudgetCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const name = categoryDisplayName(category);
  const hasBreakdown = recurringExpensesInCategory.length > 0;
  const chip = STATUS_CHIP[status];
  const percent = budgetPercent(budgeted, actual);
  const format = (amount: number) => formatCurrency(amount, defaultCurrency);

  // The whole face is one button, so its label carries everything the bar,
  // chip and chevron show visually (color is never the only signal, §9).
  const toggle = t(expanded ? 'budget.a11y.hide' : 'budget.a11y.show');
  const statusKey = A11Y_STATUS_KEY[status];
  const accessibilityLabel =
    budgeted === null
      ? t('budget.a11y.cardNoBudget', { name, spent: format(actual), toggle })
      : t('budget.a11y.card', {
          name,
          percent,
          spent: format(actual),
          budgeted: format(budgeted),
          status: statusKey ? t(statusKey) : '',
          toggle,
        });

  return (
    <Card style={styles.categoryCard}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        style={styles.face}
      >
        <View style={styles.faceRow}>
          <View style={styles.faceMain}>
            <ThemedText type="smallBold">{name}</ThemedText>
            {chip && <Chip label={t(chip.labelKey)} tone={chip.tone} style={styles.chip} />}
          </View>
          <View style={styles.faceAmounts}>
            <ThemedText type="smallBold">{format(actual)}</ThemedText>
            <ThemedText type="caption">
              {budgeted === null ? t('budget.noBudgetSet') : t('budget.ofBudgeted', { amount: format(budgeted) })}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        </View>
        {budgeted !== null && status !== 'none' && (
          <ProgressBar status={status} budgeted={budgeted} actual={actual} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <CategoryStatusLines
            status={status}
            budgeted={budgeted}
            actual={actual}
            pending={pending}
            percent={percent}
            format={format}
          />
        </View>
      )}

      {/* Existing per-recurring breakdown, kept as-is until phase 5 reworks
          the expanded detail (avoids losing it on develop in between). */}
      {expanded && hasBreakdown && (
        <View style={styles.breakdown}>
          {recurringExpensesInCategory.map((definition, index) => (
            <View key={definition.id}>
              <View style={styles.breakdownRow}>
                <ThemedText type="caption">{definition.name}</ThemedText>
                <View style={styles.breakdownAmounts}>
                  <ThemedText type="caption">
                    {t('budget.recurringBudgeted', {
                      // definition.amount is in the definition's own currency
                      // — convert before formatting with defaultCurrency's
                      // convention, same fix as budget-recommendation-badge.tsx.
                      amount: formatCurrency(definition.amount * definition.exchangeRateToDefault, defaultCurrency),
                    })}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {definition.budgetRecommendation.rollingAverageAmount === null
                      ? t('budget.noHistoryYet')
                      : t('budget.recurringAverage', {
                          amount: formatCurrency(definition.budgetRecommendation.rollingAverageAmount, defaultCurrency),
                        })}
                  </ThemedText>
                </View>
              </View>
              <BudgetRecommendationBadge definition={definition} />
              {index < recurringExpensesInCategory.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

type CategoryStatusLinesProps = {
  status: BudgetStatus;
  budgeted: number | null;
  actual: number;
  pending: number;
  percent: number;
  format: (amount: number) => string;
};

// §5.6 points 1-2: one status line, plus a projection line whenever
// something is still pending this cycle. Whole lines are colored (not just
// the amount) — agreed simplification to avoid <Trans> markup.
function CategoryStatusLines({ status, budgeted, actual, pending, percent, format }: CategoryStatusLinesProps) {
  const { t } = useTranslation();

  if (budgeted === null) {
    return <ThemedText type="caption">{t('budget.detail.noBudget')}</ThemedText>;
  }

  const projected = projectedTotal(actual, pending);

  return (
    <>
      {status === 'over' ? (
        <ThemedText type="caption" themeColor="danger">
          {t('budget.detail.over', { amount: format(actual - budgeted), percent })}
        </ThemedText>
      ) : status === 'exact' ? (
        <ThemedText type="caption" themeColor="success">
          {t('budget.detail.exact')}
        </ThemedText>
      ) : (
        <ThemedText type="caption">{t('budget.detail.remaining', { amount: format(budgeted - actual), percent })}</ThemedText>
      )}
      {pending > 0 && (
        <ThemedText type="caption" themeColor={projected > budgeted ? 'warning' : 'textSecondary'}>
          {t('budget.detail.projection', {
            pending: format(pending),
            projected: format(projected),
            percent: budgetPercent(budgeted, projected),
          })}
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    gap: Spacing.two,
  },
  face: {
    gap: Spacing.two,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  faceMain: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  faceAmounts: {
    alignItems: 'flex-end',
  },
  detail: {
    gap: Spacing.one,
  },
  breakdown: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  breakdownAmounts: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
