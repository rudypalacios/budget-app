import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { ConfirmAmountModal } from '@/components/confirm-amount-modal';
import { GroupHeaderRow } from '@/components/group-header-row';
import { PaymentRowItem } from '@/components/payment-row-item';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Fab } from '@/components/ui/fab';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { GroupPickerDialog } from '@/components/ui/group-picker-dialog';
import type { OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useGroupDragOrchestration } from '@/hooks/use-group-drag-orchestration';
import { groupDropTargetId } from '@/lib/drag-drop-groups';
import type { PaymentRow } from '@/lib/payments-dashboard';
import type { DashboardBucket, DashboardSections, GroupSection } from '@/lib/recurring-groups';
import { useCategoriesStore } from '@/store/categories';
import { archiveExpense, setExpenseGroupId, setExpensePaid, setExpenseSkipped, trashExpense } from '@/store/expenses';
import { archiveIncome, setIncomeReceived, setIncomeSkipped, trashIncome } from '@/store/incomes';
import { addRecurringGroup } from '@/store/recurring-groups';
import { runRecurringGeneration } from '@/store/recurring-generation';
import { useSessionStore } from '@/store/session';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';

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

// Same as togglePaid, but with a user-confirmed amount from
// ConfirmAmountModal (recurring instances only — see handleTogglePaid).
function confirmMarkPaid(row: PaymentRow, amount: number) {
  if (row.direction === 'expense') {
    setExpensePaid(row.id, true, amount);
    if (row.skipped) setExpenseSkipped(row.id, false);
  } else {
    setIncomeReceived(row.id, true, amount);
    if (row.skipped) setIncomeSkipped(row.id, false);
  }
}

function toggleSkipped(row: PaymentRow) {
  if (row.direction === 'expense') {
    setExpenseSkipped(row.id, !row.skipped);
  } else {
    setIncomeSkipped(row.id, !row.skipped);
  }
}

// FR-4a/4b (data-model.md §7) — a generated instance can be archived/
// trashed independently of its parent recurring definition, same as a
// one-time record. Applies to both kind values shown on this dashboard.
// A grouped member is archived/trashed on its own too — the group it
// belongs to holds no state of its own to cascade (Stage 18 redo).
function archiveRow(row: PaymentRow) {
  if (row.direction === 'expense') {
    archiveExpense(row.id);
  } else {
    archiveIncome(row.id);
  }
}

function trashRow(row: PaymentRow) {
  if (row.direction === 'expense') {
    trashExpense(row.id);
  } else {
    trashIncome(row.id);
  }
}

// Every row/group-header the drop math needs to resolve against lives
// across three buckets and, within each, a plain-rows list plus however
// many groups' member lists — flattened once per render so a drag's
// otherRowId (Step: create a new group) can be resolved back to a real
// PaymentRow regardless of which bucket/group it's currently rendered
// under. bucket.rows and each group's members are already disjoint
// (buildDashboardSections filters grouped rows out of bucket.rows), so
// this never double-counts a row.
function flattenAllRows(sections: DashboardSections): PaymentRow[] {
  const all: PaymentRow[] = [];
  for (const bucket of [sections.overdue, sections.upcoming, sections.completed]) {
    all.push(...bucket.rows);
    for (const group of bucket.groups) all.push(...group.members);
  }
  return all;
}

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const dashboard = usePaymentsDashboard();
  const { overdue, upcoming, completed } = dashboard;
  const categories = useCategoriesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const uid = useSessionStore((state) => state.uid);
  const { refreshing, onRefresh } = usePullToRefresh(() => uid && runRecurringGeneration(uid));
  const scrollY = useSharedValue(0);
  // Only recurring instances go through the confirm-amount modal — a
  // one-time row's amount is already exact and not in question, so it keeps
  // the instant one-tap toggle (see togglePaid).
  const [confirmRow, setConfirmRow] = useState<PaymentRow | null>(null);
  // Stage 18 redo (FR-21) — the "Grupo…" row action's picker.
  const [groupPickerRow, setGroupPickerRow] = useState<PaymentRow | null>(null);
  // Which group headers are expanded — collapsed by default so an open
  // group doesn't push the rest of the list down before the user asks for
  // it, same reasoning as category-budget-card.tsx's per-category accordion.
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const allRows = useMemo(() => flattenAllRows(dashboard), [dashboard]);

  async function createGroupAndAssign(name: string, draggedId: string, otherId: string) {
    const groupId = await addRecurringGroup(name);
    await Promise.all([setExpenseGroupId(draggedId, groupId), setExpenseGroupId(otherId, groupId)]);
  }

  const { dragAndDrop, groupCreatePrompt, createGroupSuggestedName, handleConfirmCreateGroup, handleCancelCreateGroup } =
    useGroupDragOrchestration(allRows, categories, setExpenseGroupId, createGroupAndAssign);

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

  function handleTogglePaid(row: PaymentRow) {
    const nextPaid = !row.paid;
    if (nextPaid && row.kind === 'recurringInstance') {
      setConfirmRow(row);
    } else {
      togglePaid(row);
    }
  }

  function overflowItemsFor(row: PaymentRow): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [{ label: t('common.edit'), onPress: () => router.push(editHref(row)) }];
    // Skip only makes sense on an unpaid recurring instance — one-time
    // records have no skipped field (data-model.md §12), and skipping
    // something already paid isn't a meaningful action.
    if (row.kind === 'recurringInstance' && !row.paid) {
      items.push({
        label: row.skipped ? t('payments.unskip') : t('payments.skip'),
        onPress: () => toggleSkipped(row),
      });
    }
    // Stage 18 redo (FR-21) — grouping is expense-only.
    if (row.direction === 'expense') {
      items.push({ label: t('recurringGroups.rowAction'), onPress: () => setGroupPickerRow(row) });
    }
    items.push(
      {
        label: t('common.archive'),
        onPress: () => {
          archiveRow(row);
          showToast(t('archive.movedToArchive', { name: row.name }));
        },
      },
      {
        label: t('common.delete'),
        onPress: () => {
          trashRow(row);
          showToast(t('archive.movedToTrash', { name: row.name }));
        },
      },
    );
    return items;
  }

  function renderPaymentRow(row: PaymentRow, isOverdue: boolean) {
    return (
      <PaymentRowItem
        key={row.id}
        row={row}
        isOverdue={isOverdue}
        isDropTarget={dragAndDrop.hoveredTargetId === row.id}
        dragAndDrop={dragAndDrop}
        categories={categories}
        defaultCurrency={defaultCurrency}
        onTogglePaid={handleTogglePaid}
        overflowItems={overflowItemsFor(row)}
      />
    );
  }

  function renderGroupSection(section: GroupSection<PaymentRow>, isOverdue: boolean) {
    const expanded = expandedGroupIds.has(section.groupId);
    return (
      <Card key={section.groupId} style={styles.card}>
        <GroupHeaderRow
          section={section}
          expanded={expanded}
          isDropTarget={dragAndDrop.hoveredTargetId === groupDropTargetId(section.groupId)}
          dragAndDrop={dragAndDrop}
          onToggleExpanded={toggleGroupExpanded}
          defaultCurrency={defaultCurrency}
        />
        {expanded &&
          section.members.map((member) => (
            <View key={member.id}>
              <Divider style={styles.divider} />
              {renderPaymentRow(member, isOverdue)}
            </View>
          ))}
      </Card>
    );
  }

  function renderSection(title: string, bucket: DashboardBucket, emptyLabel: string, isOverdue = false) {
    const isEmpty = bucket.rows.length === 0 && bucket.groups.length === 0;
    return (
      <View style={styles.section}>
        <SectionHeader title={title} />
        {isEmpty ? (
          <ThemedText type="caption">{emptyLabel}</ThemedText>
        ) : (
          <>
            {bucket.rows.length > 0 && (
              <Card style={styles.card}>
                {bucket.rows.map((row, index) => (
                  <View key={row.id}>
                    {renderPaymentRow(row, isOverdue)}
                    {index < bucket.rows.length - 1 && <Divider style={styles.divider} />}
                  </View>
                ))}
              </Card>
            )}
            {bucket.groups.map((section) => renderGroupSection(section, isOverdue))}
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} scrollOffset={scrollY}>
        <ScreenHeader title={t('payments.title')} />

        {renderSection(t('payments.overdue'), overdue, t('payments.nothingOverdue'), true)}
        {renderSection(t('payments.upcoming'), upcoming, t('payments.nothingUpcoming'))}
        {(completed.rows.length > 0 || completed.groups.length > 0) &&
          renderSection(t('payments.completedThisCycle'), completed, '')}
      </ScreenScroll>
      <Fab
        label={t('payments.quickExpense')}
        icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
        onPress={() => router.push('/payments/quick-expense')}
        scrollOffset={scrollY}
      />
      {confirmRow && (
        <ConfirmAmountModal
          key={confirmRow.id}
          isOpen
          title={t('payments.confirmAmount.title', { name: confirmRow.name })}
          currency={confirmRow.currency}
          initialAmount={confirmRow.amount}
          onSave={(amount) => {
            confirmMarkPaid(confirmRow, amount);
            setConfirmRow(null);
          }}
          onDiscard={() => setConfirmRow(null)}
        />
      )}
      {groupPickerRow && (
        <GroupPickerDialog
          isOpen
          onClose={() => setGroupPickerRow(null)}
          value={groupPickerRow.recurringGroupId}
          onSelect={(recurringGroupId) => setExpenseGroupId(groupPickerRow.id, recurringGroupId)}
        />
      )}
      {groupCreatePrompt && (
        <GroupNameDialog
          key={`${groupCreatePrompt.draggedItem.id}-${groupCreatePrompt.otherItem.id}`}
          isOpen
          title={t('recurringGroups.createTitle')}
          initialName={createGroupSuggestedName}
          onConfirm={handleConfirmCreateGroup}
          onCancel={handleCancelCreateGroup}
        />
      )}
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
