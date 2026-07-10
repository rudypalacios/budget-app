import { router, type Href } from 'expo-router';
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
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { setIncomeReceived, useIncomesStore } from '@/store/incomes';

export default function IncomeScreen() {
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);

  function toggleReceived(id: string, paid: boolean) {
    setIncomeReceived(id, !paid);
  }

  const sortedIncomes = [...incomes].sort((a, b) => b.date.toMillis() - a.date.toMillis());

  return (
    <ScreenScroll>
      <ScreenHeader title="Income" />

      <View style={styles.actionsRow}>
        <Button label="Add income" onPress={() => router.push('/income/new')} style={styles.actionButton} />
        <Button
          label="Manage recurring"
          variant="secondary"
          // expo-router's typed-routes generator doesn't emit the collapsed
          // '/recurring-incomes' alias for a plain (non-group) folder's
          // index.tsx — same gap as '/categories' (see settings.tsx).
          onPress={() => router.push('/recurring-incomes' as Href)}
          style={styles.actionButton}
        />
      </View>

      <View style={styles.list}>
        {sortedIncomes.map((income, index) => {
          const category = categories.find((c) => c.id === income.categoryId);
          return (
            <View key={income.id}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{income.name}</ThemedText>
                  <View style={styles.rowMeta}>
                    <ThemedText type="caption">{category?.name}</ThemedText>
                    {income.kind === 'recurringInstance' && <Chip label="Recurring" />}
                  </View>
                </View>
                <View style={styles.rowAmount}>
                  <ThemedText type="smallBold" themeColor="success">
                    {formatCurrency(income.amount, income.currency)}
                  </ThemedText>
                  <View style={styles.switchRow}>
                    <ThemedText type="caption">{income.paid ? 'Received' : 'Expected'}</ThemedText>
                    <Switch
                      value={income.paid}
                      onValueChange={() => toggleReceived(income.id, income.paid)}
                      accessibilityLabel={`Mark ${income.name} as ${income.paid ? 'expected' : 'received'}`}
                    />
                  </View>
                </View>
                <OverflowMenu
                  accessibilityLabel={`Actions for ${income.name}`}
                  items={[
                    {
                      label: 'Edit',
                      onPress: () =>
                        router.push({ pathname: '/income/[id]/edit', params: { id: income.id } }),
                    },
                  ]}
                />
              </View>
              {index < sortedIncomes.length - 1 && <Divider style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
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
