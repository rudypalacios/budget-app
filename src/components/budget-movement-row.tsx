import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import { getExpenseAmount } from '@/lib/payments-dashboard';
import type { CurrencyCode, ExpenseRecord } from '@/types/firestore';

export type BudgetMovementRowProps = {
  expense: WithId<ExpenseRecord>;
  defaultCurrency: CurrencyCode;
};

// One read-only line of a category's "This month's movements" (Presupuesto
// redesign D9). Deliberately no actions: paying/editing stays on the
// Dashboard and Expenses tabs — the Budget screen only shows and warns.
// Pending uses a warning chip, paid a neutral one; overdue isn't flagged
// red here on purpose (the Dashboard owns "what's overdue", this screen
// only answers "am I within budget").
export function BudgetMovementRow({ expense, defaultCurrency }: BudgetMovementRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // paidDate is guaranteed once paid (see isPaidInCycle); pending rows show
  // their due date instead.
  const shownDate = expense.paid ? expense.paidDate!.toDate() : expense.date.toDate();
  // Same amount the Dashboard shows (an unconfirmed recurring instance falls
  // back to its budgeted amount, in the record's own currency).
  const amount = getExpenseAmount(expense);

  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <View style={styles.nameRow}>
          <ThemedText type="small" style={styles.name}>
            {expense.name}
          </ThemedText>
          {/* An icon, not a chip: it says "recurring" without a second chip
              crowding the row (the paid/pending chip is the one that changes). */}
          {expense.kind === 'recurringInstance' && (
            <View accessible accessibilityRole="image" accessibilityLabel={t('budget.detail.movementRecurring')}>
              <SymbolView
                name={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' }}
                size={14}
                tintColor={theme.textSecondary}
              />
            </View>
          )}
        </View>
        <View style={styles.meta}>
          <ThemedText type="caption" style={styles.date}>
            {formatShortDate(shownDate)}
          </ThemedText>
          <Chip
            label={t(expense.paid ? 'budget.detail.movementPaid' : 'budget.detail.movementPending')}
            tone={expense.paid ? 'neutral' : 'warning'}
          />
        </View>
      </View>
      <ThemedText type="small" style={styles.amount}>
        {formatCurrencyWithConversion(amount, expense.currency, expense.amountInDefaultCurrency, defaultCurrency)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  main: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flexShrink: 1,
  },
  // Wraps on narrow widths instead of squeezing the date.
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  date: {
    flexShrink: 0,
  },
  amount: {
    textAlign: 'right',
  },
});
