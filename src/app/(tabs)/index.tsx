import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ConfirmAmountModal } from '@/components/confirm-amount-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { GroupCascadeDialog } from '@/components/ui/group-cascade-dialog';
import { GroupPickerDialog } from '@/components/ui/group-picker-dialog';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Checkbox } from '@/components/ui/checkbox';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/lib/category-display';
import { computeGroupedSubtotal, eligibleGroupParents, findActiveChildren } from '@/lib/expense-grouping';
import { formatCurrency, formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import { expenseToPaymentRow, type PaymentRow } from '@/lib/payments-dashboard';
import { useCategoriesStore } from '@/store/categories';
import {
  archiveExpense,
  archiveOrTrashExpenseGroup,
  setExpenseGroupParent,
  setExpensePaid,
  setExpenseSkipped,
  trashExpense,
  useExpensesStore,
} from '@/store/expenses';
import { archiveIncome, setIncomeReceived, setIncomeSkipped, trashIncome } from '@/store/incomes';
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
// Plain transitions only — a row with active children goes through the
// cascade dialog instead (Stage 18, FR-21e — see handleArchiveOrTrash in
// PaymentsScreen below).
function directArchiveRow(row: PaymentRow) {
  if (row.direction === 'expense') {
    archiveExpense(row.id);
  } else {
    archiveIncome(row.id);
  }
}

function directTrashRow(row: PaymentRow) {
  if (row.direction === 'expense') {
    trashExpense(row.id);
  } else {
    trashIncome(row.id);
  }
}

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const { overdueUnpaid, upcomingUnpaid, completedThisCycle } = usePaymentsDashboard();
  const categories = useCategoriesStore((state) => state.items);
  const expenses = useExpensesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const theme = useTheme();
  const uid = useSessionStore((state) => state.uid);
  const { refreshing, onRefresh } = usePullToRefresh(() => uid && runRecurringGeneration(uid));
  // Only recurring instances go through the confirm-amount modal — a
  // one-time row's amount is already exact and not in question, so it keeps
  // the instant one-tap toggle (see togglePaid).
  const [confirmRow, setConfirmRow] = useState<PaymentRow | null>(null);
  // Stage 18 (FR-21b) — follow-up confirm-amount queue for expenses that
  // just got cascaded to paid (a group parent's active recurringInstance
  // children, when the parent was the one directly toggled) — see
  // queuePendingChildConfirmations. A cascaded child is populated into this
  // queue only *after* the cascade actually happened (from confirmRow's own
  // onSave, or right after a plain togglePaid on a one-time parent), never
  // upfront — discarding confirmRow itself must never leave stale entries
  // here for children that were never actually marked paid.
  const [childAmountQueue, setChildAmountQueue] = useState<PaymentRow[]>([]);
  // Stage 18 (FR-21, data-model.md §11) — "Add to group..." picker and the
  // archive/trash cascade-or-detach confirmation. Both only ever apply to
  // expense rows (income isn't groupable).
  const [groupPickerRow, setGroupPickerRow] = useState<PaymentRow | null>(null);
  const [cascadeTarget, setCascadeTarget] = useState<{ row: PaymentRow; transition: 'archive' | 'trash' } | null>(
    null,
  );

  // FR-21b — every active recurringInstance child that's about to be (or
  // was just) swept to paid by the group cascade also gets its own amount
  // confirmation, same as if the user had tapped its switch directly; a
  // cascade shouldn't silently skip the same validation a direct toggle
  // gets. Reads `expenses` (this render's snapshot) before the cascade
  // this call is following has landed back through the listener — that's
  // fine here since it's only used to decide *which* children need
  // confirming, not to read a value the cascade itself is writing.
  function queuePendingChildConfirmations(row: PaymentRow) {
    if (row.direction !== 'expense') return;
    const pending = findActiveChildren(expenses, row.id)
      .filter((child) => child.kind === 'recurringInstance' && !child.paid)
      .map(expenseToPaymentRow);
    if (pending.length > 0) setChildAmountQueue(pending);
  }

  function handleTogglePaid(row: PaymentRow) {
    const nextPaid = !row.paid;
    if (nextPaid && row.kind === 'recurringInstance') {
      setConfirmRow(row);
    } else if (nextPaid) {
      togglePaid(row);
      queuePendingChildConfirmations(row);
    } else {
      togglePaid(row);
    }
  }

  // FR-21e: a row with active children needs the cascade dialog instead of
  // a plain transition — checked against the raw expenses store (which,
  // unlike the dashboard's own rows, includes every lifecycleState, letting
  // findActiveChildren filter it itself).
  function handleArchiveOrTrash(row: PaymentRow, transition: 'archive' | 'trash') {
    if (row.direction === 'expense' && findActiveChildren(expenses, row.id).length > 0) {
      setCascadeTarget({ row, transition });
      return;
    }
    if (transition === 'archive') {
      directArchiveRow(row);
      showToast(t('archive.movedToArchive', { name: row.name }));
    } else {
      directTrashRow(row);
      showToast(t('archive.movedToTrash', { name: row.name }));
    }
  }

  function renderGroup(title: string, rows: PaymentRow[], emptyLabel: string, isOverdue = false) {
    // Stage 18 (FR-21f) — `rows` already arrives reordered so each parent's
    // children sit directly after it (orderRowsWithGroupedChildren, called
    // from usePaymentsDashboard). Rebuilding the same parent->children
    // grouping here (cheap — this bucket's rows only) lets each child know
    // whether it's the last sibling actually adjacent to its parent in
    // *this* rendered list, so the connector glyph can be a real "└─▸" (last)
    // vs "├─▸" (more siblings follow) instead of always the same glyph.
    const childrenByParentIdInThisBucket = new Map<string, PaymentRow[]>();
    for (const row of rows) {
      if (row.direction === 'expense' && row.parentExpenseId) {
        const siblings = childrenByParentIdInThisBucket.get(row.parentExpenseId) ?? [];
        siblings.push(row);
        childrenByParentIdInThisBucket.set(row.parentExpenseId, siblings);
      }
    }

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
                    ? t('payments.status.received')
                    : t('payments.status.expected')
                  : row.paid
                    ? t('payments.status.paid')
                    : t('payments.status.unpaid');

              const overflowItems: OverflowMenuItem[] = [
                { label: t('common.edit'), onPress: () => router.push(editHref(row)) },
              ];
              // Skip only makes sense on an unpaid recurring instance —
              // one-time records have no skipped field (data-model.md §12),
              // and skipping something already paid isn't a meaningful action.
              if (row.kind === 'recurringInstance' && !row.paid) {
                overflowItems.push({
                  label: row.skipped ? t('payments.unskip') : t('payments.skip'),
                  onPress: () => toggleSkipped(row),
                });
              }
              // Stage 18 (FR-21) — grouping is expense-only.
              if (row.direction === 'expense') {
                if (row.parentExpenseId) {
                  overflowItems.push({
                    label: t('grouping.removeFromGroup'),
                    onPress: () => setExpenseGroupParent(row.id, null),
                  });
                } else {
                  overflowItems.push({
                    label: t('grouping.addToGroup'),
                    onPress: () => setGroupPickerRow(row),
                  });
                }
              }
              overflowItems.push(
                {
                  label: t('common.archive'),
                  onPress: () => handleArchiveOrTrash(row, 'archive'),
                },
                {
                  label: t('common.delete'),
                  onPress: () => handleArchiveOrTrash(row, 'trash'),
                },
              );

              const groupChildren = row.direction === 'expense' ? findActiveChildren(expenses, row.id) : [];
              const groupParentName =
                row.direction === 'expense' && row.parentExpenseId
                  ? expenses.find((item) => item.id === row.parentExpenseId)?.name
                  : undefined;
              // Stage 18 (FR-21f) — a child renders with a real tree
              // connector (vertical trunk + horizontal branch), matching
              // the reference screenshot the user shared, replacing the
              // earlier "└─▸" text-prefix attempt. `parentIsAdjacent` is
              // only true when the parent row is actually present right
              // above this child's stack in this same bucket (see
              // orderRowsWithGroupedChildren) — a child whose parent
              // landed in a different bucket has nothing to draw a line
              // to, so it falls back to plain indent + the "Part of X"
              // caption below instead of a dangling line.
              const isGroupChild = !!groupParentName;
              const siblingsInThisBucket = row.direction === 'expense' && row.parentExpenseId
                ? (childrenByParentIdInThisBucket.get(row.parentExpenseId) ?? [])
                : [];
              const isLastSiblingInThisBucket =
                siblingsInThisBucket.length === 0 ||
                siblingsInThisBucket[siblingsInThisBucket.length - 1]?.id === row.id;
              const parentIsAdjacent =
                isGroupChild && rows.some((candidate) => candidate.id === row.parentExpenseId);
              // Stage 18 (FR-21f) — a row that directly continues its
              // parent's group (immediately after the parent, or after a
              // sibling — orderRowsWithGroupedChildren always places it
              // right there) sits flush against the row above it: no
              // divider, no extra gap, so the connector lines read as one
              // continuous block instead of a chain of separately-spaced
              // cards.
              const continuesFromAbove = isGroupChild && parentIsAdjacent;
              const checkboxElement = (
                <Checkbox
                  checked={row.paid}
                  onValueChange={() => handleTogglePaid(row)}
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
              );

              return (
                <View key={row.id}>
                  {index > 0 && !continuesFromAbove && <Divider style={styles.divider} />}
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
                    {isGroupChild && (
                      <View style={styles.connectorGutter}>
                        {parentIsAdjacent && (
                          <>
                            <View
                              style={[
                                styles.connectorTop,
                                { backgroundColor: theme.border },
                              ]}
                            />
                            {!isLastSiblingInThisBucket && (
                              <View style={[styles.connectorBottom, { backgroundColor: theme.border }]} />
                            )}
                            <View style={[styles.connectorBranch, { backgroundColor: theme.border }]} />
                          </>
                        )}
                      </View>
                    )}
                    {/* Stage 18 feedback: leading checkbox, matching the
                        tree-checkbox reference the user shared — where the
                        connector's branch stub visually plugs directly into
                        the checkbox, not into the name text. */}
                    <View style={styles.checkboxColumn}>{checkboxElement}</View>
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
                      {/* Stage 18 (FR-21f) — informational: a child names
                          its group parent (redundant when the tree
                          connector is also drawn, but it's the only cue at
                          all when the parent isn't adjacent — see
                          parentIsAdjacent above); a parent shows how much
                          of its own amount is accounted for by its active
                          children. */}
                      {groupParentName && (
                        <ThemedText type="caption" themeColor="textSecondary">
                          {t('grouping.partOf', { name: groupParentName })}
                        </ThemedText>
                      )}
                      {groupChildren.length > 0 && (
                        <ThemedText type="caption" themeColor="textSecondary">
                          {t('grouping.groupedSubtotal', {
                            count: groupChildren.length,
                            amount: formatCurrency(computeGroupedSubtotal(groupChildren), defaultCurrency),
                          })}
                        </ThemedText>
                      )}
                      <View style={styles.rowMeta}>
                        <ThemedText type="caption">{categoryDisplayName(category)}</ThemedText>
                        {/* Recurring/Skipped are grouped in their own
                            non-wrapping row so they wrap as a single unit —
                            category can drop to its own line under a narrow
                            width, but the two chips never split apart from
                            each other. */}
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
                          // Skipped rows stay neutral ("white") — they're no
                          // longer a real income/expense for the period, so
                          // the red/green income-vs-expense coding doesn't
                          // apply; the Skipped chip above is what flags them.
                          themeColor={row.skipped ? 'text' : row.direction === 'income' ? 'success' : 'danger'}
                          style={[isCompleted && styles.completedText]}
                        >
                          {row.direction === 'income' ? '+' : '-'}
                          {formatCurrencyWithConversion(
                            row.amount,
                            row.currency,
                            row.amountInDefaultCurrency,
                            defaultCurrency,
                          )}
                        </ThemedText>
                        <OverflowMenu
                          accessibilityLabel={t('common.actionsFor', { name: row.name })}
                          items={overflowItems}
                        />
                      </View>
                      <View style={styles.bottomLine}>
                        {isCompleted ? (
                          <ThemedText type="caption">{paidLabel}</ThemedText>
                        ) : (
                          <Chip label={paidLabel} tone="warning" />
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    );
  }

  return (
    <>
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
        <ScreenHeader title={t('payments.title')} />

        <Button label={t('payments.quickExpense')} onPress={() => router.push('/payments/quick-expense')} />

        {renderGroup(t('payments.overdue'), overdueUnpaid, t('payments.nothingOverdue'), true)}
        {renderGroup(t('payments.upcoming'), upcomingUnpaid, t('payments.nothingUpcoming'))}
        {completedThisCycle.length > 0 &&
          renderGroup(t('payments.completedThisCycle'), completedThisCycle, '')}
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
            // Only queue follow-up child confirmations once this row is
            // actually confirmed paid — the cascade it depends on hasn't
            // happened at all if this gets discarded instead.
            queuePendingChildConfirmations(confirmRow);
            setConfirmRow(null);
          }}
          onDiscard={() => setConfirmRow(null)}
        />
      )}
      {/* Stage 18 (FR-21b) — follow-up queue: these children were already
          cascaded to paid by the time this shows (see
          queuePendingChildConfirmations), so "discard" here means "keep the
          amount as cascaded," never "undo the payment" — unlike confirmRow
          above, where discard means the row never gets marked paid at all. */}
      {childAmountQueue.length > 0 && (
        <ConfirmAmountModal
          key={childAmountQueue[0].id}
          isOpen
          title={t('payments.confirmAmount.title', { name: childAmountQueue[0].name })}
          currency={childAmountQueue[0].currency}
          initialAmount={childAmountQueue[0].amount}
          onSave={(amount) => {
            confirmMarkPaid(childAmountQueue[0], amount);
            setChildAmountQueue((queue) => queue.slice(1));
          }}
          onDiscard={() => setChildAmountQueue((queue) => queue.slice(1))}
        />
      )}
      {groupPickerRow && (
        <GroupPickerDialog
          isOpen
          onClose={() => setGroupPickerRow(null)}
          options={eligibleGroupParents(expenses, groupPickerRow.id)}
          onSelect={(parentId) => setExpenseGroupParent(groupPickerRow.id, parentId)}
        />
      )}
      {cascadeTarget && (
        <GroupCascadeDialog
          isOpen
          onClose={() => setCascadeTarget(null)}
          transition={cascadeTarget.transition}
          parentName={cascadeTarget.row.name}
          childNames={findActiveChildren(expenses, cascadeTarget.row.id).map((child) => child.name)}
          onCascade={() => {
            archiveOrTrashExpenseGroup(cascadeTarget.row.id, cascadeTarget.transition, 'cascade');
            showToast(
              cascadeTarget.transition === 'archive'
                ? t('archive.movedToArchive', { name: cascadeTarget.row.name })
                : t('archive.movedToTrash', { name: cascadeTarget.row.name }),
            );
          }}
          onDetach={() => {
            archiveOrTrashExpenseGroup(cascadeTarget.row.id, cascadeTarget.transition, 'detach');
            showToast(
              cascadeTarget.transition === 'archive'
                ? t('archive.movedToArchive', { name: cascadeTarget.row.name })
                : t('archive.movedToTrash', { name: cascadeTarget.row.name }),
            );
          }}
        />
      )}
    </>
  );
}

// Stage 18 (FR-21f) tree-connector geometry — pulled out of styles below
// since StyleSheet.create needs plain numbers to compute absolute
// positions from, not tokens resolved at render time.
const ConnectorGutterWidth = 20;
const ConnectorLineWidth = 2;
const ConnectorBranchY = 14; // roughly the vertical center of the name line

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    // Stage 18 feedback: no uniform gap here — spacing between rows is now
    // handled per-pair (a Divider, with its own marginVertical, before any
    // row that doesn't continue the group above it; zero gap for one that
    // does), so a grouped block's rows sit flush against each other.
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
    gap: Spacing.two,
  },
  // Stage 18 feedback: the paid checkbox now leads the row (matching the
  // reference tree-checkbox screenshot) instead of trailing at the bottom
  // next to the status chip.
  checkboxColumn: {
    justifyContent: 'flex-start',
  },
  // Stage 18 (FR-21f) — a grouped child's tree connector: a fixed-width
  // gutter to the row's left holding a vertical trunk segment (top half,
  // always; bottom half too unless this is the last sibling) and a
  // horizontal branch stub connecting the trunk to this row's content.
  // Colors are set inline (theme.border) — see the row's JSX.
  connectorGutter: {
    width: ConnectorGutterWidth,
    alignSelf: 'stretch',
  },
  connectorTop: {
    position: 'absolute',
    left: ConnectorGutterWidth / 2 - ConnectorLineWidth / 2,
    top: 0,
    height: ConnectorBranchY + ConnectorLineWidth,
    width: ConnectorLineWidth,
  },
  connectorBottom: {
    position: 'absolute',
    left: ConnectorGutterWidth / 2 - ConnectorLineWidth / 2,
    top: ConnectorBranchY,
    bottom: 0,
    width: ConnectorLineWidth,
  },
  connectorBranch: {
    position: 'absolute',
    left: ConnectorGutterWidth / 2 - ConnectorLineWidth / 2,
    top: ConnectorBranchY,
    width: ConnectorGutterWidth / 2 + ConnectorLineWidth,
    height: ConnectorLineWidth,
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
});
