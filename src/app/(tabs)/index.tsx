import { SymbolView } from 'expo-symbols';
import { router, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ConfirmAmountModal } from '@/components/confirm-amount-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { DragHandle } from '@/components/ui/drag-handle';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { GroupPickerDialog } from '@/components/ui/group-picker-dialog';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useRowDragAndDrop, type RowDragAndDrop } from '@/hooks/use-row-drag-and-drop';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/lib/category-display';
import { suggestGroupName, type DropAction } from '@/lib/drag-drop-groups';
import { formatCurrency, formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import type { WithId } from '@/lib/firebase/firestore.types';
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
import type { Category } from '@/types/firestore';

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
// many groups' member lists — flattened once per render into one id->row
// map so a drag's otherRowId (Step: create a new group) can be resolved
// back to a real PaymentRow regardless of which bucket/group it's
// currently rendered under.
function flattenAllRows(sections: DashboardSections): Map<string, PaymentRow> {
  const all = new Map<string, PaymentRow>();
  for (const bucket of [sections.overdue, sections.upcoming, sections.completed]) {
    for (const row of bucket.rows) all.set(row.id, row);
    for (const group of bucket.groups) {
      for (const member of group.members) all.set(member.id, member);
    }
  }
  return all;
}

type PaymentRowItemProps = {
  row: PaymentRow;
  isOverdue: boolean;
  isDropTarget: boolean;
  dragAndDrop: RowDragAndDrop;
  categories: WithId<Category>[];
  defaultCurrency: string;
  onTogglePaid: (row: PaymentRow) => void;
  overflowItems: OverflowMenuItem[];
};

// Stage 18 follow-up (drag-and-drop grouping) — extracted from a plain
// render function into a real component because react-native-reanimated's
// useAnimatedStyle/useSharedValue can't be called from inside a .map()
// callback (Rules of Hooks). Registers its own on-screen bounds with the
// drag hook via onLayout so a drag elsewhere can detect landing on it;
// unregisters are handled by the hook's caller clearing stale entries each
// drag rather than an unmount effect, since rows routinely re-key across
// buckets as their paid state changes.
function PaymentRowItem({
  row,
  isOverdue,
  isDropTarget,
  dragAndDrop,
  categories,
  defaultCurrency,
  onTogglePaid,
  overflowItems,
}: PaymentRowItemProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const outerRef = useRef<View>(null);

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

  function handleLayout() {
    outerRef.current?.measureInWindow((x, y, width, height) => {
      dragAndDrop.registerTarget(row.id, { x, y, width, height }, { kind: 'row', row });
    });
  }

  const animatedStyle = useAnimatedStyle(() => {
    const isDragging = dragAndDrop.draggedRowIdShared.value === row.id;
    return {
      transform: isDragging
        ? [
            { translateX: dragAndDrop.translateX.value },
            { translateY: dragAndDrop.translateY.value },
            { scale: 1.03 },
          ]
        : [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      zIndex: isDragging ? 10 : 0,
      shadowOpacity: isDragging ? 0.2 : 0,
      elevation: isDragging ? 6 : 0,
    };
  });

  return (
    <View ref={outerRef} onLayout={handleLayout}>
      <Animated.View
        style={[
          styles.row,
          animatedStyle,
          // Overdue rows get a full-row danger tint (same translucent-wash
          // convention as Chip's tone colors) so an overdue bill reads as
          // urgent at a glance, not just via its "Unpaid" chip.
          isOverdue && !isCompleted ? { backgroundColor: `${theme.danger}1A` } : null,
          isDropTarget && { backgroundColor: `${theme.tint}26`, borderColor: theme.tint },
        ]}
      >
        {row.direction === 'expense' && (
          <DragHandle
            accessibilityLabel={t('recurringGroups.dragHandle', { name: row.name })}
            onDragStart={() => dragAndDrop.handleDragStart(row)}
            onDragUpdate={dragAndDrop.handleDragUpdate}
            onDragEnd={dragAndDrop.handleDragEnd}
          />
        )}
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
      </Animated.View>
    </View>
  );
}

type GroupHeaderProps = {
  section: GroupSection;
  expanded: boolean;
  isDropTarget: boolean;
  dragAndDrop: RowDragAndDrop;
  onToggleExpanded: (groupId: string) => void;
  defaultCurrency: string;
};

function GroupHeaderRow({ section, expanded, isDropTarget, dragAndDrop, onToggleExpanded, defaultCurrency }: GroupHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const outerRef = useRef<View>(null);
  const targetId = `group:${section.groupId}`;

  function handleLayout() {
    outerRef.current?.measureInWindow((x, y, width, height) => {
      dragAndDrop.registerTarget(targetId, { x, y, width, height }, { kind: 'groupHeader', groupId: section.groupId });
    });
  }

  return (
    <View ref={outerRef} onLayout={handleLayout}>
      <Pressable
        onPress={() => onToggleExpanded(section.groupId)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(expanded ? 'recurringGroups.hideMembers' : 'recurringGroups.showMembers', {
          name: section.name,
        })}
        style={[styles.groupHeader, isDropTarget && { backgroundColor: `${theme.tint}26` }]}
      >
        <View style={styles.groupHeaderMain}>
          <ThemedText type="smallBold">{section.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('recurringGroups.memberCount', { count: section.members.length })}
          </ThemedText>
        </View>
        <View style={styles.groupHeaderAside}>
          <ThemedText type="smallBold">{formatCurrency(section.subtotal, defaultCurrency)}</ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        </View>
      </Pressable>
    </View>
  );
}

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const dashboard = usePaymentsDashboard();
  const { overdue, upcoming, completed } = dashboard;
  const categories = useCategoriesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const uid = useSessionStore((state) => state.uid);
  const { refreshing, onRefresh } = usePullToRefresh(() => uid && runRecurringGeneration(uid));
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
  // Stage 18 follow-up (drag-and-drop grouping) — set only for a
  // createGroup drop (see handleDropResolved), never for the other
  // DropAction kinds, which write directly with no confirmation.
  const [groupCreatePrompt, setGroupCreatePrompt] = useState<{ draggedRow: PaymentRow; otherRow: PaymentRow } | null>(
    null,
  );

  const allRowsById = useMemo(() => flattenAllRows(dashboard), [dashboard]);

  function handleDropResolved(draggedRow: PaymentRow, action: DropAction) {
    if (action.type === 'noop') return;
    if (action.type === 'clearGroup') {
      setExpenseGroupId(draggedRow.id, null);
      return;
    }
    if (action.type === 'assignToGroup') {
      setExpenseGroupId(draggedRow.id, action.groupId);
      return;
    }
    // 'createGroup' — the only action that needs the user to confirm a
    // name before anything is written (see the earlier UX decision).
    const otherRow = allRowsById.get(action.otherRowId);
    if (!otherRow) return;
    setGroupCreatePrompt({ draggedRow, otherRow });
  }

  const dragAndDrop = useRowDragAndDrop(handleDropResolved);

  async function handleConfirmCreateGroup(name: string) {
    if (!groupCreatePrompt || !name.trim()) return;
    const { draggedRow, otherRow } = groupCreatePrompt;
    const groupId = await addRecurringGroup(name);
    await Promise.all([setExpenseGroupId(draggedRow.id, groupId), setExpenseGroupId(otherRow.id, groupId)]);
    setGroupCreatePrompt(null);
  }

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

  function renderGroupSection(section: GroupSection, isOverdue: boolean) {
    const expanded = expandedGroupIds.has(section.groupId);
    return (
      <Card key={section.groupId} style={styles.card}>
        <GroupHeaderRow
          section={section}
          expanded={expanded}
          isDropTarget={dragAndDrop.hoveredTargetId === `group:${section.groupId}`}
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

  const createGroupSuggestedName = groupCreatePrompt
    ? (suggestGroupName(groupCreatePrompt.draggedRow, groupCreatePrompt.otherRow, categories) ??
      t('recurringGroups.defaultName'))
    : '';

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
        <ScreenHeader title={t('payments.title')} />

        <Button label={t('payments.quickExpense')} onPress={() => router.push('/payments/quick-expense')} />

        {renderSection(t('payments.overdue'), overdue, t('payments.nothingOverdue'), true)}
        {renderSection(t('payments.upcoming'), upcoming, t('payments.nothingUpcoming'))}
        {(completed.rows.length > 0 || completed.groups.length > 0) &&
          renderSection(t('payments.completedThisCycle'), completed, '')}
      </ScreenScroll>
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
          key={`${groupCreatePrompt.draggedRow.id}-${groupCreatePrompt.otherRow.id}`}
          isOpen
          title={t('recurringGroups.createTitle')}
          initialName={createGroupSuggestedName}
          onConfirm={handleConfirmCreateGroup}
          onCancel={() => setGroupCreatePrompt(null)}
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
    borderWidth: 1,
    borderColor: 'transparent',
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
  divider: {
    marginVertical: Spacing.one,
  },
  completedText: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  // Stage 18 redo (FR-21f) — the group header row, same
  // Pressable-with-chevron accordion idiom as category-budget-card.tsx.
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
  },
  groupHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  groupHeaderAside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
