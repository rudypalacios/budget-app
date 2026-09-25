import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WithId } from '@/lib/firebase/firestore.types';
import { isRecommendationPending } from '@/lib/budget-recommendation';
import { formatCurrency } from '@/lib/format-currency';
import { acceptBudgetRecommendation, dismissBudgetRecommendation } from '@/store/recurring-expenses';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';
import type { RecurringExpense } from '@/types/firestore';

export type BudgetRecommendationBadgeProps = {
  definition: WithId<RecurringExpense>;
};

// Shared between the Expenses tab (one row per recurring expense) and the
// Budget tab's per-category breakdown (Stage 13, FR-6a-6d) — same data, same
// accept/dismiss actions, so both stay in sync through the one
// recurringExpenses store rather than duplicating this UI/logic twice.
export function BudgetRecommendationBadge({ definition }: BudgetRecommendationBadgeProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  const { budgetRecommendation } = definition;
  // The explicit null check is redundant with isRecommendationPending but
  // narrows suggestedBudgetedAmount to a number for TypeScript below.
  if (!isRecommendationPending(budgetRecommendation) || budgetRecommendation.suggestedBudgetedAmount === null) {
    return null;
  }

  async function handleAccept() {
    await acceptBudgetRecommendation(definition.id);
    showToast(t('recurringExpense.recommendation.accepted', { name: definition.name }));
  }

  async function handleDismiss() {
    await dismissBudgetRecommendation(definition.id);
    showToast(t('recurringExpense.recommendation.dismissed', { name: definition.name }));
  }

  // Presupuesto redesign D14 (v9 look): a tinted warning box with both
  // actions inside it as equal-width buttons, instead of a pill chip with
  // link buttons below. Shared with the Expenses tab, which gets it too.
  return (
    <View style={[styles.box, { backgroundColor: `${theme.warning}22` }]}>
      <ThemedText type="small" themeColor="warning">
        {t('recurringExpense.recommendation.message', {
          average: formatCurrency(budgetRecommendation.suggestedBudgetedAmount, defaultCurrency),
          // definition.amount is in this definition's own currency, not
          // necessarily defaultCurrency — convert before formatting with
          // defaultCurrency's convention, or a foreign-currency amount reads
          // as a defaultCurrency figure it never was (the bug this comment
          // now guards against — found live comparing a $20 bill against its
          // correctly-converted Q155 average, which rendered as "Q 20.00").
          budgeted: formatCurrency(definition.amount * definition.exchangeRateToDefault, defaultCurrency),
        })}
      </ThemedText>
      <View style={styles.actions}>
        <Button
          label={t('recurringExpense.recommendation.accept')}
          variant="secondary"
          onPress={handleAccept}
          style={styles.actionButton}
        />
        <Button
          label={t('recurringExpense.recommendation.dismiss')}
          variant="secondary"
          onPress={handleDismiss}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // Tighter side padding than a default Button so both labels usually fit
  // on one line at phone widths.
  actionButton: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
});
