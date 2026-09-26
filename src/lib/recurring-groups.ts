import type { WithId } from '@/lib/firebase/firestore.types';
import type { PaymentRow, PaymentRowGroups } from './payments-dashboard';
import type { RecurringGroup } from '@/types/firestore';

// Stage 18 redo (FR-21, data-model.md §11) — pure logic for rendering
// group headers wherever grouped rows are shown. A recurringGroups/{id}
// document holds no amount/date/paid state of its own; everything shown
// next to its name is always derived here from its current members.
//
// Generic over GroupableItem — reused by the Payments Dashboard (PaymentRow
// members, via buildDashboardSections) and the Expenses tab's "Una vez"
// (PaymentRow) and "Recurrentes" (RecurringExpense-definition-shaped)
// sections, via groupRowsIntoSections. Both PaymentRow and a RecurringExpense
// (plus a computed amountInDefaultCurrency) satisfy this structurally, with
// no adapter classes needed.
export type GroupableItem = {
  id: string;
  categoryId: string;
  amountInDefaultCurrency: number;
  recurringGroupId: string | null;
};

export function computeGroupSubtotal<T extends GroupableItem>(members: T[]): number {
  return members.reduce((sum, member) => sum + member.amountInDefaultCurrency, 0);
}

export type GroupBucketName = 'overdue' | 'upcoming' | 'completed';

// A group only moves to 'completed' once every member is paid/skipped — a
// partial payment leaves it in whichever open bucket its still-unpaid
// members call for ('overdue' if any of them is past due, else 'upcoming').
// Stays PaymentRow-specific (not part of GroupableItem) — a recurring
// definition is never itself "paid", so this bucket concept only makes
// sense for actual payment rows, which is exactly what the Dashboard's
// three-bucket layout needs it for.
export function groupBucket(
  members: PaymentRow[],
  referenceDate: Date = new Date(),
): GroupBucketName {
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const unpaidMembers = members.filter((member) => !member.paid && !member.skipped);
  if (unpaidMembers.length === 0) return 'completed';
  return unpaidMembers.some((member) => member.date < startOfToday) ? 'overdue' : 'upcoming';
}

export type GroupSection<T extends GroupableItem> = {
  groupId: string;
  name: string;
  subtotal: number;
  members: T[];
};

export type DashboardBucket = {
  // Rows not folded into a group header — ungrouped, or grouped under a
  // group that isn't active (an archived/trashed group stops rendering a
  // header, but doesn't detach its members; see recurring-groups.ts store).
  rows: PaymentRow[];
  groups: GroupSection<PaymentRow>[];
};

export type DashboardSections = {
  overdue: DashboardBucket;
  upcoming: DashboardBucket;
  completed: DashboardBucket;
};

// Shared by buildDashboardSections and groupRowsIntoSections — gathers
// each active group's current members by group id, and the set of row ids
// that ended up folded into a header (so the caller can filter them out of
// its own plain-row list).
function gatherMembersByGroupId<T extends GroupableItem>(
  rows: T[],
  activeGroups: WithId<RecurringGroup>[],
): { membersByGroupId: Map<string, T[]>; groupedRowIds: Set<string> } {
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));

  const membersByGroupId = new Map<string, T[]>();
  const groupedRowIds = new Set<string>();
  for (const row of rows) {
    if (row.recurringGroupId && activeGroupIds.has(row.recurringGroupId)) {
      const members = membersByGroupId.get(row.recurringGroupId) ?? [];
      members.push(row);
      membersByGroupId.set(row.recurringGroupId, members);
      groupedRowIds.add(row.id);
    }
  }

  return { membersByGroupId, groupedRowIds };
}

// Folds each active group's members — gathered across all three buckets,
// since a partially-settled group can have members split across them —
// into a single header entry placed in the one bucket groupBucket assigns
// it to. Members keep the relative order groupPaymentRows already sorted
// them into (overdue-by-date, then upcoming-by-date, then
// completed-by-action-timestamp).
export function buildDashboardSections(
  buckets: PaymentRowGroups,
  activeGroups: WithId<RecurringGroup>[],
): DashboardSections {
  // Income rows never group (recurringGroupId is expense-only), but this
  // filter is defensive — it keeps a future store bug from accidentally
  // folding an income row into a header rather than relying solely on the
  // field staying unset.
  const allRows = [
    ...buckets.overdueUnpaid,
    ...buckets.upcomingUnpaid,
    ...buckets.completedThisCycle,
  ].filter((row) => row.direction === 'expense');
  const { membersByGroupId, groupedRowIds } = gatherMembersByGroupId(allRows, activeGroups);

  const sectionsByBucket: Record<GroupBucketName, GroupSection<PaymentRow>[]> = {
    overdue: [],
    upcoming: [],
    completed: [],
  };
  for (const group of activeGroups) {
    const members = membersByGroupId.get(group.id);
    if (!members || members.length === 0) continue;
    sectionsByBucket[groupBucket(members)].push({
      groupId: group.id,
      name: group.name,
      subtotal: computeGroupSubtotal(members),
      members,
    });
  }

  function dashboardBucket(rows: PaymentRow[], bucket: GroupBucketName): DashboardBucket {
    return {
      rows: rows.filter((row) => !groupedRowIds.has(row.id)),
      groups: sectionsByBucket[bucket],
    };
  }

  return {
    overdue: dashboardBucket(buckets.overdueUnpaid, 'overdue'),
    upcoming: dashboardBucket(buckets.upcomingUnpaid, 'upcoming'),
    completed: dashboardBucket(buckets.completedThisCycle, 'completed'),
  };
}

// The single-list equivalent of buildDashboardSections, for screens with
// no bucket concept (the Expenses tab's flat "Una vez"/"Recurrentes"
// sections) — every active group with at least one member here becomes one
// GroupSection, in no particular bucket; ungrouped/inactive-group rows
// come back as-is in `rows`.
export function groupRowsIntoSections<T extends GroupableItem>(
  rows: T[],
  activeGroups: WithId<RecurringGroup>[],
): { rows: T[]; groups: GroupSection<T>[] } {
  const { membersByGroupId, groupedRowIds } = gatherMembersByGroupId(rows, activeGroups);

  const groups: GroupSection<T>[] = [];
  for (const group of activeGroups) {
    const members = membersByGroupId.get(group.id);
    if (!members || members.length === 0) continue;
    groups.push({
      groupId: group.id,
      name: group.name,
      subtotal: computeGroupSubtotal(members),
      members,
    });
  }

  return { rows: rows.filter((row) => !groupedRowIds.has(row.id)), groups };
}

export type GroupUsage = {
  // What the group visibly holds today, for its row on the Recurring groups
  // screen: active recurring definitions and one-time expenses assigned to
  // it, plus active recurring instances assigned to it directly (not
  // through their definition). Instances of a definition already listed
  // don't add a second entry, so a monthly bill counts once, not once per
  // month.
  memberNames: string[];
  // Every expense record or recurring definition pointing at the group, in
  // any lifecycle state (active, archived, trashed-but-not-purged) — its
  // history. Any at all means the group can't be deleted outright, only
  // archived (Ajustes redesign, owner decision: never lose which expenses
  // belonged to a group). Same rule as canDeleteCategory.
  referenceCount: number;
};

type GroupReferenceExpense = {
  id: string;
  kind: 'oneTime' | 'recurringInstance';
  name: string;
  lifecycleState: string;
  recurringGroupId: string | null;
  recurringExpenseId: string | null;
};

type GroupReferenceDefinition = {
  id: string;
  name: string;
  lifecycleState: string;
  recurringGroupId: string | null;
};

export function describeGroupUsage(
  groupId: string,
  expenses: readonly GroupReferenceExpense[],
  recurringExpenses: readonly GroupReferenceDefinition[],
): GroupUsage {
  const inGroupExpenses = expenses.filter((item) => item.recurringGroupId === groupId);
  const inGroupDefinitions = recurringExpenses.filter((item) => item.recurringGroupId === groupId);

  const activeDefinitions = inGroupDefinitions.filter((item) => item.lifecycleState === 'active');
  const listedDefinitionIds = new Set(activeDefinitions.map((item) => item.id));
  const memberNames = activeDefinitions.map((item) => item.name);

  for (const expense of inGroupExpenses) {
    if (expense.lifecycleState !== 'active') continue;
    if (expense.kind === 'oneTime') {
      memberNames.push(expense.name);
      continue;
    }
    // An instance assigned on its own: list it once per definition.
    const definitionKey = expense.recurringExpenseId ?? expense.id;
    if (listedDefinitionIds.has(definitionKey)) continue;
    listedDefinitionIds.add(definitionKey);
    memberNames.push(expense.name);
  }

  return {
    memberNames,
    referenceCount: inGroupExpenses.length + inGroupDefinitions.length,
  };
}
