import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/lib/category-display';
import { formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { PaymentRow } from '@/lib/payments-dashboard';
import type { Category } from '@/types/firestore';

type PaymentRowItemProps = {
  row: PaymentRow;
  isOverdue: boolean;
  categories: WithId<Category>[];
  defaultCurrency: string;
  onTogglePaid: (row: PaymentRow) => void;
  overflowItems: OverflowMenuItem[];
};

// Extracted out of (tabs)/index.tsx into a shared component (Expenses-
// grouping follow-up) so the Expenses tab's "Una vez" section can render
// its rows identically to the Dashboard's — same row markup, reused
// wherever grouping needs to render a member row.
export function PaymentRowItem({
  row,
  isOverdue,
  categories,
  defaultCurrency,
  onTogglePaid,
  overflowItems,
}: PaymentRowItemProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const category = categories.find((c) => c.id === row.categoryId);
  const isCompleted = row.paid || row.skipped;
  const paidLabel =
    row.direction === 'income'
      ? row.paid
        ? t('payments.status.received')
        : t('payments.status.expected')
      : row.paid
        ? t('payments.status.paid')
        : t('payments.status.unpaid');

  return (
    <View
      style={[
        styles.row,
        // Overdue rows get a full-row danger tint (same translucent-wash
        // convention as Chip's tone colors) so an overdue bill reads as
        // urgent at a glance, not just via its "Unpaid" chip.
        isOverdue && !isCompleted ? { backgroundColor: `${theme.danger}1A` } : null,
      ]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold" style={[isCompleted && styles.completedText]}>
          {row.name}{' '}
          <ThemedText type="caption" themeColor="textSecondary">
            {row.paid && row.paidDate
              ? t('payments.dueWithPaid', {
                  dueDate: formatShortDate(row.date),
                  paidDate: formatShortDate(row.paidDate),
                })
              : t('payments.dueOnly', { dueDate: formatShortDate(row.date) })}
          </ThemedText>
        </ThemedText>
        <View style={styles.rowMeta}>
          <ThemedText type="caption">{categoryDisplayName(category)}</ThemedText>
          {/* Recurring/Skipped are grouped in their own non-wrapping row so
              they wrap as a single unit — category can drop to its own
              line under a narrow width, but the two chips never split
              apart from each other. */}
          {(row.kind === 'recurringInstance' || row.skipped) && (
            <View style={styles.tagsGroup}>
              {row.kind === 'recurringInstance' && <Chip label={t('payments.recurringChip')} />}
              {row.skipped && <Chip label={t('payments.skippedChip')} tone="warning" />}
            </View>
          )}
        </View>
      </View>
      <View style={styles.rowAside}>
        <View style={styles.amountLine}>
          <ThemedText
            type="smallBold"
            // Skipped rows stay neutral ("white") — they're no longer a
            // real income/expense for the period, so the red/green
            // income-vs-expense coding doesn't apply; the Skipped chip
            // above is what flags them.
            themeColor={row.skipped ? 'text' : row.direction === 'income' ? 'success' : 'danger'}
            style={[isCompleted && styles.completedText]}
          >
            {row.direction === 'income' ? '+' : '-'}
            {formatCurrencyWithConversion(row.amount, row.currency, row.amountInDefaultCurrency, defaultCurrency)}
          </ThemedText>
          <OverflowMenu accessibilityLabel={t('common.actionsFor', { name: row.name })} items={overflowItems} />
        </View>
        <View style={styles.bottomLine}>
          {isCompleted ? (
            <ThemedText type="caption">{paidLabel}</ThemedText>
          ) : (
            <Chip label={paidLabel} tone="warning" />
          )}
          <Switch
            value={row.paid}
            onValueChange={() => onTogglePaid(row)}
            accessibilityLabel={t('payments.markAs', {
              name: row.name,
              state:
                row.direction === 'income'
                  ? row.paid
                    ? t('payments.state.expected')
                    : t('payments.state.received')
                  : row.paid
                    ? t('payments.state.unpaid')
                    : t('payments.state.paid'),
            })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Top-aligned, not centered — the left column (rowMain) can grow
    // taller than the right column (rowAside) once category/tags wrap
    // onto extra lines, and rowAside should stay pinned to the top rather
    // than vertically centering against that extra height.
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tagsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowAside: {
    gap: Spacing.one,
    alignItems: 'flex-end',
  },
  amountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  completedText: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
});
