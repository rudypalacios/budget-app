import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { categoriesStore, expensesStore } from '@/lib/mock-stores';
import { formatCurrency } from '@/lib/format-currency';

export default function ExpensesScreen() {
  const { items: expenses, updateItem } = expensesStore.useStore();
  const { items: categories } = categoriesStore.useStore();

  function togglePaid(id: string, paid: boolean) {
    updateItem(id, { paid: !paid });
  }

  const sortedExpenses = [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <ScreenScroll>
      <ScreenHeader title="Expenses" />

      <Button label="Add expense" onPress={() => router.push('/expenses/new')} />

      <View style={styles.list}>
        {sortedExpenses.map((expense, index) => {
          const category = categories.find((c) => c.id === expense.categoryId);
          return (
            <View key={expense.id}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{expense.name}</ThemedText>
                  <View style={styles.rowMeta}>
                    <ThemedText type="caption">{category?.name}</ThemedText>
                    {expense.kind === 'recurringInstance' && <Chip label="Recurring" />}
                  </View>
                </View>
                <View style={styles.rowAmount}>
                  <ThemedText type="smallBold">{formatCurrency(expense.amount, expense.currency)}</ThemedText>
                  <View style={styles.switchRow}>
                    <ThemedText type="caption">{expense.paid ? 'Paid' : 'Unpaid'}</ThemedText>
                    <Switch
                      value={expense.paid}
                      onValueChange={() => togglePaid(expense.id, expense.paid)}
                      accessibilityLabel={`Mark ${expense.name} as ${expense.paid ? 'unpaid' : 'paid'}`}
                    />
                  </View>
                </View>
                <OverflowMenu
                  accessibilityLabel={`Actions for ${expense.name}`}
                  items={[
                    {
                      label: 'Edit',
                      onPress: () =>
                        router.push({ pathname: '/expenses/[id]/edit', params: { id: expense.id } }),
                    },
                  ]}
                />
              </View>
              {index < sortedExpenses.length - 1 && <Divider style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  list: {
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
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowAmount: {
    gap: Spacing.one,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
