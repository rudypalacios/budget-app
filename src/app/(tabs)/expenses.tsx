import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { archiveExpense, trashExpense, useExpensesStore } from '@/store/expenses';
import { archiveRecurringExpense, trashRecurringExpense, useRecurringExpensesStore } from '@/store/recurring-expenses';
import { showToast } from '@/store/toast';

// This screen is config-only: creating/editing planned expenses (one-time
// or recurring templates). Marking a specific occurrence paid/unpaid/skipped
// — and the overdue tag — lives exclusively on the Payments tab
// (src/app/(tabs)/index.tsx, the Payments screen, Stage 8), which already
// unifies both kinds.
export default function ExpensesScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringDefinitions = useRecurringExpensesStore((state) => state.items);

  const activeRecurring = recurringDefinitions.filter((definition) => definition.lifecycleState === 'active');
  const { refreshing, onRefresh } = usePullToRefresh();

  // Once a one-time expense is paid it's settled history, not a plan
  // anymore — it stays visible via Payments' "Completed this cycle" and
  // the History tab, but drops off this planning list. Archived/trashed
  // expenses drop off every normal view, per FR-4a.
  const plannedOneTime = [
    ...expenses.filter(
      (expense) => expense.kind === 'oneTime' && !expense.paid && expense.lifecycleState === 'active',
    ),
  ].sort((a, b) => b.date.toMillis() - a.date.toMillis());

  function handleArchiveDefinition(id: string, name: string) {
    archiveRecurringExpense(id);
    showToast(t('archive.movedToArchive', { name }));
  }

  function handleTrashDefinition(id: string, name: string) {
    trashRecurringExpense(id);
    showToast(t('archive.movedToTrash', { name }));
  }

  function handleArchiveExpense(id: string, name: string) {
    archiveExpense(id);
    showToast(t('archive.movedToArchive', { name }));
  }

  function handleTrashExpense(id: string, name: string) {
    trashExpense(id);
    showToast(t('archive.movedToTrash', { name }));
  }

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t('expenses.title')} />

      <Button label={t('expenses.addExpense')} onPress={() => router.push('/expenses/new')} />

      <View style={styles.section}>
        <SectionHeader title={t('expenses.recurringSection')} />
        {activeRecurring.length === 0 ? (
          <ThemedText type="caption">{t('expenses.noRecurring')}</ThemedText>
        ) : (
          <Card style={styles.card}>
            {activeRecurring.map((definition, index) => (
              <View key={definition.id}>
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
                      items={[
                        {
                          label: t('common.edit'),
                          onPress: () =>
                            router.push({ pathname: '/recurring-expenses/[id]/edit', params: { id: definition.id } }),
                        },
                        {
                          label: t('common.archive'),
                          onPress: () => handleArchiveDefinition(definition.id, definition.name),
                        },
                        {
                          label: t('common.delete'),
                          onPress: () => handleTrashDefinition(definition.id, definition.name),
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
        <SectionHeader title={t('expenses.oneTimeSection')} />
        {plannedOneTime.length === 0 ? (
          <ThemedText type="caption">{t('expenses.noOneTime')}</ThemedText>
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
                      <ThemedText type="smallBold" themeColor="danger">
                        {formatCurrency(expense.amount ?? 0, expense.currency)}
                      </ThemedText>
                      <OverflowMenu
                        accessibilityLabel={t('common.actionsFor', { name: expense.name })}
                        items={[
                          {
                            label: t('common.edit'),
                            onPress: () => router.push({ pathname: '/expenses/[id]/edit', params: { id: expense.id } }),
                          },
                          {
                            label: t('common.archive'),
                            onPress: () => handleArchiveExpense(expense.id, expense.name),
                          },
                          {
                            label: t('common.delete'),
                            onPress: () => handleTrashExpense(expense.id, expense.name),
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
