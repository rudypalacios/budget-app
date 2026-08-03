import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BudgetRecommendationBadge } from '@/components/budget-recommendation-badge';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { archiveExpense, setExpensePaid, trashExpense, useExpensesStore } from '@/store/expenses';
import {
  archiveRecurringExpense,
  recomputeStaleBudgetRecommendations,
  trashRecurringExpense,
  useRecurringExpensesStore,
} from '@/store/recurring-expenses';
import { showToast } from '@/store/toast';

// Primarily for planning/config (creating/editing one-time expenses and
// recurring templates), with a quick paid toggle on one-time rows below —
// full paid/unpaid/skipped triage across both expenses and income, plus the
// overdue tag, still lives on the Dashboard tab (src/app/(tabs)/index.tsx,
// Stage 8), which unifies both kinds in one prioritized view.
export default function ExpensesScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringDefinitions = useRecurringExpensesStore((state) => state.items);

  const activeRecurring = recurringDefinitions.filter((definition) => definition.lifecycleState === 'active');
  const { refreshing, onRefresh } = usePullToRefresh();

  // data-model.md §9: catches drift missed by a stale cache — e.g. a bulk
  // 'stale' write from another device's defaultCurrency change (Stage 11)
  // finally gets a real recompute once this tab is viewed again.
  useEffect(() => {
    recomputeStaleBudgetRecommendations();
  }, []);

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

  // A row shown in the One-time section is always currently unpaid (see
  // plannedOneTime's filter above) — marking it paid here just removes it
  // from this list on the next render, same reasoning as the Payments
  // dashboard's own toggle, which this calls directly.
  function handleMarkExpensePaid(id: string) {
    setExpensePaid(id, true);
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
                <BudgetRecommendationBadge definition={definition} />
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
                  <View style={styles.bottomLine}>
                    <Chip label={t('payments.status.unpaid')} tone="warning" />
                    <Switch
                      value={false}
                      onValueChange={() => handleMarkExpensePaid(expense.id)}
                      accessibilityLabel={t('payments.markAs', {
                        name: expense.name,
                        state: t('payments.state.paid'),
                      })}
                    />
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
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
