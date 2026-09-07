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
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/lib/category-display';
import { computeGroupedSubtotal, eligibleGroupParents, findActiveChildren } from '@/lib/expense-grouping';
import { formatCurrency, formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import type { PaymentRow } from '@/lib/payments-dashboard';
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
  // Stage 18 (FR-21, data-model.md §11) — "Add to group..." picker and the
  // archive/trash cascade-or-detach confirmation. Both only ever apply to
  // expense rows (income isn't groupable).
  const [groupPickerRow, setGroupPickerRow] = useState<PaymentRow | null>(null);
  const [cascadeTarget, setCascadeTarget] = useState<{ row: PaymentRow; transition: 'archive' | 'trash' } | null>(
    null,
  );

  function handleTogglePaid(row: PaymentRow) {
    const nextPaid = !row.paid;
    if (nextPaid && row.kind === 'recurringInstance') {
      setConfirmRow(row);
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
              // Stage 18 (FR-21f) — a child renders indented with an ASCII
              // tree-connector prefix on its own name line, same idea as the
              // original mockup discussed with the user. Every child uses
              // the same "└─▸" connector rather than distinguishing
              // middle/last siblings (├─▸ vs └─▸): rows within a bucket are
              // sorted by date/action-timestamp, not grouped together, so a
              // parent's children are rarely contiguous in the rendered
              // list — a "last sibling" glyph would imply an adjacency that
              // isn't real. See data-model.md §11 for why a literal nested
              // tree (reordering rows so children sit right under their
              // parent) isn't feasible given the three-bucket layout.
              const isGroupChild = !!groupParentName;

              return (
                <View key={row.id}>
                  <View
                    style={[
                      styles.row,
                      isGroupChild && styles.rowChild,
                      // Overdue rows get a full-row danger tint (same
                      // translucent-wash convention as Chip's tone colors)
                      // so an overdue bill reads as urgent at a glance, not
                      // just via its "Unpaid" chip.
                      isOverdue && !isCompleted ? { backgroundColor: `${theme.danger}1A` } : null,
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold" style={[isCompleted && styles.completedText]}>
                        {isGroupChild ? '└─▸ ' : ''}
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
                      {/* Stage 18 (FR-21f) — informational only: a child
                          shows which group it belongs to (via the "└─▸"
                          prefix above plus this caption naming the parent),
                          a parent shows how much of its own amount is
                          accounted for by its active children. */}
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
                        <Switch
                          value={row.paid}
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
                      </View>
                    </View>
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
            setConfirmRow(null);
          }}
          onDiscard={() => setConfirmRow(null)}
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
    gap: Spacing.two,
  },
  // Stage 18 (FR-21f) — indents a grouped child's row so its "└─▸" name
  // prefix reads as a visual sub-item, not just another top-level row.
  rowChild: {
    paddingLeft: Spacing.two + Spacing.four,
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
