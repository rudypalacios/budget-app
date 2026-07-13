import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';

// This screen is config-only: creating/editing planned expenses (one-time
// or recurring templates). Marking a specific occurrence paid/unpaid/skipped
// — and the overdue tag — lives exclusively on the Payments tab
// (src/app/(tabs)/payments.tsx, Stage 8), which already unifies both kinds.
export default function ExpensesScreen() {
  const expenses = useExpensesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringDefinitions = useRecurringExpensesStore((state) => state.items);

  const activeRecurring = recurringDefinitions.filter((definition) => definition.lifecycleState === 'active');

  // Once a one-time expense is paid it's settled history, not a plan
  // anymore — it stays visible via Payments' "Completed this cycle" and
  // the History tab, but drops off this planning list.
  const plannedOneTime = [...expenses.filter((expense) => expense.kind === 'oneTime' && !expense.paid)].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis(),
  );

  return (
    <ScreenScroll>
      <ScreenHeader title="Expenses" />

      <Button label="Add expense" onPress={() => router.push('/expenses/new')} />

      <View style={styles.section}>
        <SectionHeader title="Recurring" />
        {activeRecurring.length === 0 ? (
          <ThemedText type="caption">No recurring expenses yet.</ThemedText>
        ) : (
          <Card style={styles.card}>
            {activeRecurring.map((definition, index) => (
              <View key={definition.id}>
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <ThemedText type="smallBold">{definition.name}</ThemedText>
                    <ThemedText type="caption">Due day {definition.dueDay}</ThemedText>
                  </View>
                  <View style={styles.rowEnd}>
                    <ThemedText type="smallBold">{formatCurrency(definition.amount, definition.currency)}</ThemedText>
                    <OverflowMenu
                      accessibilityLabel={`Actions for ${definition.name}`}
                      items={[
                        {
                          label: 'Edit',
                          onPress: () =>
                            router.push({ pathname: '/recurring-expenses/[id]/edit', params: { id: definition.id } }),
                        },
                      ]}
                    />
                  </View>
                </View>
                {index < activeRecurring.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="One-time" />
        {plannedOneTime.length === 0 ? (
          <ThemedText type="caption">No planned one-time expenses.</ThemedText>
        ) : (
          <Card style={styles.card}>
            {plannedOneTime.map((expense, index) => {
              const category = categories.find((c) => c.id === expense.categoryId);
              return (
                <View key={expense.id}>
                  <View style={styles.row}>
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold">{expense.name}</ThemedText>
                      <ThemedText type="caption">{category?.name}</ThemedText>
                    </View>
                    <View style={styles.rowEnd}>
                      <ThemedText type="smallBold">{formatCurrency(expense.amount ?? 0, expense.currency)}</ThemedText>
                      <OverflowMenu
                        accessibilityLabel={`Actions for ${expense.name}`}
                        items={[
                          {
                            label: 'Edit',
                            onPress: () => router.push({ pathname: '/expenses/[id]/edit', params: { id: expense.id } }),
                          },
                        ]}
                      />
                    </View>
                  </View>
                  {index < plannedOneTime.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        )}
      </View>
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
  divider: {
    marginVertical: Spacing.one,
  },
});
