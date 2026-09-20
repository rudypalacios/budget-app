import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { GroupHeaderRow } from '@/components/group-header-row';
import { PaymentRowItem } from '@/components/payment-row-item';
import { RecurringDefinitionRowItem, toGroupableRecurringExpense } from '@/components/recurring-definition-row-item';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Fab } from '@/components/ui/fab';
import { GroupPickerDialog } from '@/components/ui/group-picker-dialog';
import type { OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { expenseToPaymentRow, type PaymentRow } from '@/lib/payments-dashboard';
import { groupRowsIntoSections, type GroupableItem, type GroupSection } from '@/lib/recurring-groups';
import { useCategoriesStore } from '@/store/categories';
import { archiveExpense, setExpenseGroupId, setExpensePaid, trashExpense, useExpensesStore } from '@/store/expenses';
import { runRecurringGeneration } from '@/store/recurring-generation';
import {
  archiveRecurringExpense,
  recomputeStaleBudgetRecommendations,
  trashRecurringExpense,
  updateRecurringExpense,
  useRecurringExpensesStore,
} from '@/store/recurring-expenses';
import { useRecurringGroupsStore } from '@/store/recurring-groups';
import { useSessionStore } from '@/store/session';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';

// Primarily for planning/config (creating/editing one-time expenses and
// recurring templates), with a quick paid toggle on one-time rows below —
// full paid/unpaid/skipped triage across both expenses and income, plus the
// overdue tag, still lives on the Dashboard tab (src/app/(tabs)/index.tsx,
// Stage 8), which unifies both kinds in one prioritized view.
//
// Expenses-grouping follow-up — both sections below support the same
// "Grupo…" grouping action as the Dashboard: "Una vez" reuses PaymentRowItem
// directly (its rows are the same PaymentRow shape, via expenseToPaymentRow);
// "Recurrentes" reuses the shared group core over a definition's own
// GroupableRecurringExpense shape (no paid/date/skipped — a definition is
// never itself "paid"). The two sections' groups are entirely independent —
// a definition's own recurringGroupId (set here) is what a newly-generated
// instance inherits each cycle (recurring-generation.ts); an instance's own
// recurringGroupId (set via the Dashboard's or this screen's "Una vez"
// "Grupo…" picker) is a separate, ad hoc override that never writes back to
// the definition.
export default function ExpensesScreen() {
  const { t } = useTranslation();
  const expenses = useExpensesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringDefinitions = useRecurringExpensesStore((state) => state.items);
  const recurringGroups = useRecurringGroupsStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  const activeGroups = useMemo(
    () => recurringGroups.filter((group) => group.lifecycleState === 'active'),
    [recurringGroups],
  );

  const activeRecurring = recurringDefinitions.filter((definition) => definition.lifecycleState === 'active');
  const uid = useSessionStore((state) => state.uid);
  const { refreshing, onRefresh } = usePullToRefresh(() => uid && runRecurringGeneration(uid));
  const scrollY = useSharedValue(0);

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

  const oneTimeRows = useMemo(() => plannedOneTime.map(expenseToPaymentRow), [plannedOneTime]);
  const oneTimeSections = useMemo(
    () => groupRowsIntoSections(oneTimeRows, activeGroups),
    [oneTimeRows, activeGroups],
  );

  const recurringRows = useMemo(() => activeRecurring.map(toGroupableRecurringExpense), [activeRecurring]);
  const recurringSections = useMemo(
    () => groupRowsIntoSections(recurringRows, activeGroups),
    [recurringRows, activeGroups],
  );

  // Which group headers are expanded — collapsed by default, same
  // reasoning as the Dashboard's own accordion. One shared set works for
  // both sections since their group ids never collide with each other
  // (both come from the one recurringGroups collection).
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  function toggleGroupExpanded(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function assignRecurringGroup(id: string, groupId: string | null) {
    return updateRecurringExpense(id, { recurringGroupId: groupId });
  }

  // Stage 18 redo (FR-21) — the "Grupo…" row action's picker, one instance
  // shared by both sections (only one can ever be open at a time).
  const [groupPickerTarget, setGroupPickerTarget] = useState<
    { kind: 'oneTime'; row: PaymentRow } | { kind: 'recurring'; id: string; groupId: string | null } | null
  >(null);

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
  function handleMarkExpensePaid(row: PaymentRow) {
    setExpensePaid(row.id, true);
  }

  function oneTimeOverflowItems(row: PaymentRow): OverflowMenuItem[] {
    return [
      { label: t('common.edit'), onPress: () => router.push({ pathname: '/expenses/[id]/edit', params: { id: row.id } }) },
      { label: t('recurringGroups.rowAction'), onPress: () => setGroupPickerTarget({ kind: 'oneTime', row }) },
      {
        label: t('common.archive'),
        onPress: () => handleArchiveExpense(row.id, row.name),
      },
      {
        label: t('common.delete'),
        onPress: () => handleTrashExpense(row.id, row.name),
      },
    ];
  }

  function recurringOverflowItems(definition: { id: string; name: string; recurringGroupId: string | null }): OverflowMenuItem[] {
    return [
      {
        label: t('common.edit'),
        onPress: () => router.push({ pathname: '/recurring-expenses/[id]/edit', params: { id: definition.id } }),
      },
      {
        label: t('recurringGroups.rowAction'),
        onPress: () => setGroupPickerTarget({ kind: 'recurring', id: definition.id, groupId: definition.recurringGroupId }),
      },
      {
        label: t('common.archive'),
        onPress: () => handleArchiveDefinition(definition.id, definition.name),
      },
      {
        label: t('common.delete'),
        onPress: () => handleTrashDefinition(definition.id, definition.name),
      },
    ];
  }

  // Both sections' grouped rows render identically (Card → GroupHeaderRow →
  // expand-conditional member list), differing only in which row component
  // is plugged in — extracted once so the two sections don't duplicate this
  // JSX, mirroring how (tabs)/index.tsx already solved the same problem for
  // its own single section.
  function renderGroupSections<T extends GroupableItem>(groups: GroupSection<T>[], renderRow: (item: T) => ReactNode) {
    return groups.map((section) => {
      const expanded = expandedGroupIds.has(section.groupId);
      return (
        <Card key={section.groupId} style={styles.card}>
          <GroupHeaderRow
            section={section}
            expanded={expanded}
            onToggleExpanded={toggleGroupExpanded}
            defaultCurrency={defaultCurrency}
          />
          {expanded &&
            section.members.map((item) => (
              <View key={item.id}>
                <Divider style={styles.divider} />
                {renderRow(item)}
              </View>
            ))}
        </Card>
      );
    });
  }

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} scrollOffset={scrollY}>
        <ScreenHeader title={t('expenses.title')} />

        <View style={styles.section}>
          <SectionHeader title={t('expenses.recurringSection')} />
          {recurringRows.length === 0 ? (
            <ThemedText type="caption">{t('expenses.noRecurring')}</ThemedText>
          ) : (
            <>
              {recurringSections.rows.length > 0 && (
                <Card style={styles.card}>
                  {recurringSections.rows.map((definition, index) => (
                    <View key={definition.id}>
                      <RecurringDefinitionRowItem definition={definition} overflowItems={recurringOverflowItems(definition)} />
                      {index < recurringSections.rows.length - 1 && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </Card>
              )}
              {renderGroupSections(recurringSections.groups, (definition) => (
                <RecurringDefinitionRowItem definition={definition} overflowItems={recurringOverflowItems(definition)} />
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('expenses.oneTimeSection')} />
          {oneTimeRows.length === 0 ? (
            <ThemedText type="caption">{t('expenses.noOneTime')}</ThemedText>
          ) : (
            <>
              {oneTimeSections.rows.length > 0 && (
                <Card style={styles.card}>
                  {oneTimeSections.rows.map((row, index) => (
                    <View key={row.id}>
                      <PaymentRowItem
                        row={row}
                        isOverdue={false}
                        categories={categories}
                        defaultCurrency={defaultCurrency}
                        onTogglePaid={handleMarkExpensePaid}
                        overflowItems={oneTimeOverflowItems(row)}
                      />
                      {index < oneTimeSections.rows.length - 1 && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </Card>
              )}
              {renderGroupSections(oneTimeSections.groups, (row) => (
                <PaymentRowItem
                  row={row}
                  isOverdue={false}
                  categories={categories}
                  defaultCurrency={defaultCurrency}
                  onTogglePaid={handleMarkExpensePaid}
                  overflowItems={oneTimeOverflowItems(row)}
                />
              ))}
            </>
          )}
        </View>

        {groupPickerTarget && (
          <GroupPickerDialog
            isOpen
            onClose={() => setGroupPickerTarget(null)}
            value={
              groupPickerTarget.kind === 'oneTime' ? groupPickerTarget.row.recurringGroupId : groupPickerTarget.groupId
            }
            onSelect={(recurringGroupId) => {
              if (groupPickerTarget.kind === 'oneTime') {
                setExpenseGroupId(groupPickerTarget.row.id, recurringGroupId);
              } else {
                assignRecurringGroup(groupPickerTarget.id, recurringGroupId);
              }
            }}
          />
        )}
      </ScreenScroll>
      <Fab
        label={t('expenses.addExpense')}
        icon={{ ios: 'plus', android: 'add', web: 'add' }}
        onPress={() => router.push('/expenses/new')}
        scrollOffset={scrollY}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
