import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import type { PaymentRow } from '@/lib/payments-dashboard';
import { useCategoriesStore } from '@/store/categories';
import { setExpensePaid, setExpenseSkipped } from '@/store/expenses';
import { setIncomeReceived, setIncomeSkipped } from '@/store/incomes';

function editHref(row: PaymentRow): Href {
  return row.direction === 'expense'
    ? ({ pathname: '/expenses/[id]/edit', params: { id: row.id } } as Href)
    : ({ pathname: '/income/[id]/edit', params: { id: row.id } } as Href);
}

// Paying a row also clears any skipped state — an occurrence you just paid
// is, by definition, no longer one you're choosing not to pay this period
// (data-model.md §12). Un-paying deliberately leaves skipped untouched.
function togglePaid(row: PaymentRow) {
  const nextPaid = !row.paid;
  if (row.direction === 'expense') {
    setExpensePaid(row.id, nextPaid);
    if (nextPaid && row.skipped) setExpenseSkipped(row.id, false);
  } else {
    setIncomeReceived(row.id, nextPaid);
    if (nextPaid && row.skipped) setIncomeSkipped(row.id, false);
  }
}

function toggleSkipped(row: PaymentRow) {
  if (row.direction === 'expense') {
    setExpenseSkipped(row.id, !row.skipped);
  } else {
    setIncomeSkipped(row.id, !row.skipped);
  }
}

export default function PaymentsScreen() {
  const { overdueUnpaid, upcomingUnpaid, completedThisCycle } = usePaymentsDashboard();
  const categories = useCategoriesStore((state) => state.items);
  const theme = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();

  function renderGroup(title: string, rows: PaymentRow[], emptyLabel: string, isOverdue = false) {
    return (
      <View style={styles.section}>
        <SectionHeader title={title} />
        {rows.length === 0 ? (
          <ThemedText type="caption">{emptyLabel}</ThemedText>
        ) : (
          <Card style={styles.card}>
            {rows.map((row, index) => {
              const category = categories.find((c) => c.id === row.categoryId);
              const isCompleted = row.paid || row.skipped;
              const paidLabel =
                row.direction === 'income'
                  ? row.paid
                    ? 'Received'
                    : 'Expected'
                  : row.paid
                    ? 'Paid'
                    : 'Unpaid';

              const overflowItems: OverflowMenuItem[] = [
                { label: 'Edit', onPress: () => router.push(editHref(row)) },
              ];
              // Skip only makes sense on an unpaid recurring instance —
              // one-time records have no skipped field (data-model.md §12),
              // and skipping something already paid isn't a meaningful action.
              if (row.kind === 'recurringInstance' && !row.paid) {
                overflowItems.push({
                  label: row.skipped ? 'Unskip' : 'Skip',
                  onPress: () => toggleSkipped(row),
                });
              }

              return (
                <View key={row.id}>
                  <View
                    style={[
                      styles.row,
                      // Overdue rows get a full-row danger tint (same
                      // translucent-wash convention as Chip's tone colors)
                      // so an overdue bill reads as urgent at a glance, not
                      // just via its "Unpaid" chip.
                      isOverdue && !isCompleted ? { backgroundColor: `${theme.danger}1A` } : null,
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold" style={[isCompleted && styles.completedText]}>
                        {row.name}{' '}
                        <ThemedText type="caption" themeColor="textSecondary">
                          (Due: {formatShortDate(row.date)}
                          {row.paid && row.paidDate ? `, Paid: ${formatShortDate(row.paidDate)}` : ''})
                        </ThemedText>
                      </ThemedText>
                      <View style={styles.rowMeta}>
                        <ThemedText type="caption">{category?.name}</ThemedText>
                        {row.kind === 'recurringInstance' && <Chip label="Recurring" />}
                        {row.skipped && <Chip label="Skipped" tone="warning" />}
                      </View>
                    </View>
                    <View style={styles.rowAmount}>
                      <ThemedText
                        type="smallBold"
                        // Skipped rows stay neutral ("white") — they're no
                        // longer a real income/expense for the period, so
                        // the red/green income-vs-expense coding doesn't
                        // apply; the Skipped chip above is what flags them.
                        themeColor={row.skipped ? 'text' : row.direction === 'income' ? 'success' : 'danger'}
                        style={[isCompleted && styles.completedText]}
                      >
                        {row.direction === 'income' ? '+' : '-'}
                        {formatCurrency(row.amount, row.currency)}
                      </ThemedText>
                      <View style={styles.switchRow}>
                        {isCompleted ? (
                          <ThemedText type="caption">{paidLabel}</ThemedText>
                        ) : (
                          <Chip label={paidLabel} tone="warning" />
                        )}
                        <Switch
                          value={row.paid}
                          onValueChange={() => togglePaid(row)}
                          accessibilityLabel={`Mark ${row.name} as ${
                            row.direction === 'income'
                              ? row.paid
                                ? 'expected'
                                : 'received'
                              : row.paid
                                ? 'unpaid'
                                : 'paid'
                          }`}
                        />
                      </View>
                    </View>
                    <OverflowMenu
                      accessibilityLabel={`Actions for ${row.name}`}
                      items={overflowItems}
                    />
                  </View>
                  {index < rows.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    );
  }

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Payments" />

      <Button label="Quick expense" onPress={() => router.push('/payments/quick-expense')} />

      {renderGroup('Overdue', overdueUnpaid, 'Nothing overdue.', true)}
      {renderGroup('Upcoming', upcomingUnpaid, 'Nothing upcoming.')}
      {completedThisCycle.length > 0 && renderGroup('Completed this cycle', completedThisCycle, '')}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowAmount: {
    gap: Spacing.one,
    alignItems: 'flex-end',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
  completedText: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
});
