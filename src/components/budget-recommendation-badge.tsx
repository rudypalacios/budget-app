import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import type { WithId } from '@/lib/firebase/firestore.types';
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
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  const { budgetRecommendation } = definition;
  if (budgetRecommendation.status !== 'pending' || budgetRecommendation.suggestedBudgetedAmount === null) {
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

  return (
    <View style={styles.container}>
      <Chip
        tone="warning"
        label={t('recurringExpense.recommendation.message', {
          average: formatCurrency(budgetRecommendation.suggestedBudgetedAmount, defaultCurrency),
          budgeted: formatCurrency(definition.amount, defaultCurrency),
        })}
      />
      <View style={styles.actions}>
        <Button
          label={t('recurringExpense.recommendation.accept')}
          variant="ghost"
          onPress={handleAccept}
          style={styles.actionButton}
        />
        <Button
          label={t('recurringExpense.recommendation.dismiss')}
          variant="ghost"
          onPress={handleDismiss}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
