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
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import type { Category, CurrencyCode, RecurringExpense } from '@/types/firestore';

export type CategoryBudgetCardProps = {
  category: WithId<Category>;
  actual: number;
  defaultCurrency: CurrencyCode;
  // Active recurring expenses in this category — the per-bill breakdown
  // (Stage 13 user feedback: a single category total can hide which
  // specific bill actually changed, e.g. "Services" masking that only
  // Electrical drifted). Summary by default; this only renders once expanded.
  recurringExpensesInCategory: WithId<RecurringExpense>[];
};

export function CategoryBudgetCard({
  category,
  actual,
  defaultCurrency,
  recurringExpensesInCategory,
}: CategoryBudgetCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const budgeted = category.monthlyBudget;
  const isOverBudget = budgeted !== null && actual > budgeted;
  const hasBreakdown = recurringExpensesInCategory.length > 0;

  return (
    <Card style={styles.categoryCard}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        disabled={!hasBreakdown}
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: !hasBreakdown }}
        accessibilityLabel={t(expanded ? 'budget.hideDetails' : 'budget.details')}
        style={styles.categoryHeader}
      >
        <View style={styles.categoryHeaderMain}>
          <ThemedText type="smallBold">{category.name}</ThemedText>
          {isOverBudget && <Chip label={t('budget.overBudgetChip')} tone="danger" />}
        </View>
        {hasBreakdown && (
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        )}
      </Pressable>

      {budgeted !== null ? (
        <>
          <ProgressBar budgeted={budgeted} actual={actual} />
          <View style={styles.categoryFooter}>
            <ThemedText type="caption">
              {t('budget.spent', { amount: formatCurrency(actual, defaultCurrency) })}
            </ThemedText>
            <ThemedText type="caption">
              {t('budget.ofBudgeted', { amount: formatCurrency(budgeted, defaultCurrency) })}
            </ThemedText>
          </View>
        </>
      ) : (
        <View style={styles.categoryFooter}>
          <ThemedText type="caption">{formatCurrency(actual, defaultCurrency)}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('budget.noBudgetSet')}
          </ThemedText>
        </View>
      )}

      {expanded && hasBreakdown && (
        <View style={styles.breakdown}>
          {recurringExpensesInCategory.map((definition, index) => (
            <View key={definition.id}>
              <View style={styles.breakdownRow}>
                <ThemedText type="caption">{definition.name}</ThemedText>
                <View style={styles.breakdownAmounts}>
                  <ThemedText type="caption">
                    {t('budget.recurringBudgeted', { amount: formatCurrency(definition.amount, defaultCurrency) })}
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

const styles = StyleSheet.create({
  categoryCard: {
    gap: Spacing.two,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
