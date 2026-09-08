import { SymbolView } from 'expo-symbols';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Pressable, View } from 'react-native';

import { ConfirmAmountModal } from '@/components/confirm-amount-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { GroupPickerDialog } from '@/components/ui/group-picker-dialog';
import { OverflowMenu, type OverflowMenuItem } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { usePaymentsDashboard } from '@/hooks/use-payments-dashboard';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/lib/category-display';
import { formatCurrency, formatCurrencyWithConversion } from '@/lib/format-currency';
import { formatShortDate } from '@/lib/format-date';
import type { PaymentRow } from '@/lib/payments-dashboard';
import type { DashboardBucket, GroupSection } from '@/lib/recurring-groups';
import { useCategoriesStore } from '@/store/categories';
import { archiveExpense, setExpenseGroupId, setExpensePaid, setExpenseSkipped, trashExpense } from '@/store/expenses';
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

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const { overdue, upcoming, completed } = usePaymentsDashboard();
  const categories = useCategoriesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const theme = useTheme();
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

    return (
      <View
        style={[
          styles.row,
          // Overdue rows get a full-row danger tint (same translucent-wash
          // convention as Chip's tone colors) so an overdue bill reads as
          // urgent at a glance, not just via its "Unpaid" chip.
          isOverdue && !isCompleted ? { backgroundColor: `${theme.danger}1A` } : null,
        ]}
      >
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
            <OverflowMenu
              accessibilityLabel={t('common.actionsFor', { name: row.name })}
              items={overflowItemsFor(row)}
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
    );
  }

  function renderGroupSection(section: GroupSection, isOverdue: boolean) {
    const expanded = expandedGroupIds.has(section.groupId);
    return (
      <Card key={section.groupId} style={styles.card}>
        <Pressable
          onPress={() => toggleGroupExpanded(section.groupId)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={t(expanded ? 'recurringGroups.hideMembers' : 'recurringGroups.showMembers', {
            name: section.name,
          })}
          style={styles.groupHeader}
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
