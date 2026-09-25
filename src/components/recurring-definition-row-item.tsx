import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BudgetRecommendationBadge } from '@/components/budget-recommendation-badge';
import { ThemedText } from '@/components/themed-text';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { RecurringExpense } from '@/types/firestore';

// A recurring expense *definition* has no amountInDefaultCurrency field of
// its own (unlike a generated instance/PaymentRow) — it's computed here so
// the definition structurally satisfies GroupableItem for the shared group
// core (src/lib/recurring-groups.ts). This is a group *subtotal* concern
// only ("this group's combined monthly amount"), not a currency-conversion
// display fix — the row's own amount is still shown via plain
// formatCurrency below, unconverted, same as before this file existed.
export type GroupableRecurringExpense = WithId<RecurringExpense> & {
  amountInDefaultCurrency: number;
};

export function toGroupableRecurringExpense(
  definition: WithId<RecurringExpense>,
): GroupableRecurringExpense {
  return {
    ...definition,
    amountInDefaultCurrency: definition.amount * definition.exchangeRateToDefault,
  };
}

type RecurringDefinitionRowItemProps = {
  definition: GroupableRecurringExpense;
  overflowItems: OverflowMenuItem[];
};

// The "Recurrentes" section's row content — name, due day, amount, and its
// own Edit/Archive/Delete/Grupo… actions.
export function RecurringDefinitionRowItem({
  definition,
  overflowItems,
}: RecurringDefinitionRowItemProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <ThemedText type="smallBold">{definition.name}</ThemedText>
          <ThemedText type="caption">{t('expenses.dueDay', { day: definition.dueDay })}</ThemedText>
        </View>
        <View style={styles.rowEnd}>
          <ThemedText type="smallBold" themeColor="danger">
            {formatCurrency(definition.amount, definition.currency)}
          </ThemedText>
          <OverflowMenu
            accessibilityLabel={t('common.actionsFor', { name: definition.name })}
            items={overflowItems}
          />
        </View>
      </View>
      <BudgetRecommendationBadge definition={definition} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
