import type { WithId } from '@/lib/firebase/firestore.types';
import type { PaymentRow, PaymentRowGroups } from './payments-dashboard';
import type { RecurringGroup } from '@/types/firestore';

// Stage 18 redo (FR-21, data-model.md §11) — pure logic for the Payments
// Dashboard's group headers. A recurringGroups/{id} document holds no
// amount/date/paid state of its own; everything shown next to its name is
// always derived here from its current members.

export function computeGroupSubtotal(members: PaymentRow[]): number {
  return members.reduce((sum, member) => sum + member.amountInDefaultCurrency, 0);
}

export type GroupBucketName = 'overdue' | 'upcoming' | 'completed';

// A group only moves to 'completed' once every member is paid/skipped — a
// partial payment leaves it in whichever open bucket its still-unpaid
// members call for ('overdue' if any of them is past due, else 'upcoming').
export function groupBucket(members: PaymentRow[], referenceDate: Date = new Date()): GroupBucketName {
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const unpaidMembers = members.filter((member) => !member.paid && !member.skipped);
  if (unpaidMembers.length === 0) return 'completed';
  return unpaidMembers.some((member) => member.date < startOfToday) ? 'overdue' : 'upcoming';
}

export type GroupSection = {
  groupId: string;
  name: string;
  subtotal: number;
  members: PaymentRow[];
};

export type DashboardBucket = {
  // Rows not folded into a group header — ungrouped, or grouped under a
  // group that isn't active (an archived/trashed group stops rendering a
  // header, but doesn't detach its members; see recurring-groups.ts store).
  rows: PaymentRow[];
  groups: GroupSection[];
};

export type DashboardSections = {
  overdue: DashboardBucket;
  upcoming: DashboardBucket;
  completed: DashboardBucket;
};

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
  const allRows = [...buckets.overdueUnpaid, ...buckets.upcomingUnpaid, ...buckets.completedThisCycle];
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));

  const membersByGroupId = new Map<string, PaymentRow[]>();
  for (const row of allRows) {
    if (row.direction === 'expense' && row.recurringGroupId && activeGroupIds.has(row.recurringGroupId)) {
      const members = membersByGroupId.get(row.recurringGroupId) ?? [];
      members.push(row);
      membersByGroupId.set(row.recurringGroupId, members);
    }
  }
  const groupedRowIds = new Set(Array.from(membersByGroupId.values()).flat().map((row) => row.id));

  const sectionsByBucket: Record<GroupBucketName, GroupSection[]> = { overdue: [], upcoming: [], completed: [] };
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
    return { rows: rows.filter((row) => !groupedRowIds.has(row.id)), groups: sectionsByBucket[bucket] };
  }

  return {
    overdue: dashboardBucket(buckets.overdueUnpaid, 'overdue'),
    upcoming: dashboardBucket(buckets.upcomingUnpaid, 'upcoming'),
    completed: dashboardBucket(buckets.completedThisCycle, 'completed'),
  };
}
