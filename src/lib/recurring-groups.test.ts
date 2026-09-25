import {
  buildDashboardSections,
  computeGroupSubtotal,
  groupBucket,
  groupRowsIntoSections,
} from './recurring-groups';
import type { PaymentRow, PaymentRowGroups } from './payments-dashboard';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { RecurringGroup, Timestamp } from '@/types/firestore';

function fakeTimestamp(date: Date): Timestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

// Relative to whenever the test actually runs, not a fixed calendar date —
// buildDashboardSections calls groupBucket without a referenceDate override
// (it always uses real "now", same as groupPaymentRows itself), so these
// fixture dates need to reliably land in the future/past regardless of when
// this suite runs.
const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const farPast = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'row-1',
    direction: 'expense',
    kind: 'recurringInstance',
    name: 'Netflix',
    categoryId: 'cat-1',
    date: farFuture,
    amount: 50,
    currency: 'GTQ',
    amountInDefaultCurrency: 50,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    recurringGroupId: 'g1',
    ...overrides,
  };
}

function recurringGroup(overrides: Partial<WithId<RecurringGroup>> = {}): WithId<RecurringGroup> {
  return {
    id: 'g1',
    name: 'Suscripciones',
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 0, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 0, 1)),
    ...overrides,
  };
}

describe('computeGroupSubtotal', () => {
  it('sums amountInDefaultCurrency across members', () => {
    const members = [
      paymentRow({ id: 'a', amountInDefaultCurrency: 50 }),
      paymentRow({ id: 'b', amountInDefaultCurrency: 120 }),
    ];

    expect(computeGroupSubtotal(members)).toBe(170);
  });

  it('returns 0 for no members', () => {
    expect(computeGroupSubtotal([])).toBe(0);
  });
});

describe('groupBucket', () => {
  const referenceDate = new Date(2026, 6, 15);

  it('returns "completed" once every member is paid or skipped', () => {
    const members = [paymentRow({ id: 'a', paid: true }), paymentRow({ id: 'b', skipped: true })];

    expect(groupBucket(members, referenceDate)).toBe('completed');
  });

  it('returns "overdue" when any unpaid member is past due — a partial payment leaves the group open', () => {
    const members = [
      paymentRow({ id: 'a', paid: true }),
      paymentRow({ id: 'b', date: new Date(2026, 6, 1), paid: false }),
    ];

    expect(groupBucket(members, referenceDate)).toBe('overdue');
  });

  it('returns "upcoming" when unpaid members are not yet due', () => {
    const members = [paymentRow({ id: 'a', date: new Date(2026, 6, 20), paid: false })];

    expect(groupBucket(members, referenceDate)).toBe('upcoming');
  });
});

describe('buildDashboardSections', () => {
  function emptyBuckets(): PaymentRowGroups {
    return { overdueUnpaid: [], upcomingUnpaid: [], completedThisCycle: [] };
  }

  it("folds a group's members into one header, removed from the plain rows list", () => {
    const buckets: PaymentRowGroups = {
      ...emptyBuckets(),
      upcomingUnpaid: [
        paymentRow({
          id: 'netflix',
          name: 'Netflix',
          recurringGroupId: 'g1',
          amountInDefaultCurrency: 50,
        }),
        paymentRow({
          id: 'disney',
          name: 'Disney+',
          recurringGroupId: 'g1',
          amountInDefaultCurrency: 30,
        }),
        paymentRow({ id: 'standalone', name: 'Groceries', recurringGroupId: null }),
      ],
    };

    const sections = buildDashboardSections(buckets, [recurringGroup()]);

    expect(sections.upcoming.rows.map((row) => row.id)).toEqual(['standalone']);
    expect(sections.upcoming.groups).toHaveLength(1);
    expect(sections.upcoming.groups[0]).toMatchObject({
      groupId: 'g1',
      name: 'Suscripciones',
      subtotal: 80,
    });
    expect(sections.upcoming.groups[0].members.map((m) => m.id)).toEqual(['netflix', 'disney']);
    expect(sections.overdue.groups).toHaveLength(0);
    expect(sections.completed.groups).toHaveLength(0);
  });

  it('places the group header in "overdue" when any unpaid member is past due', () => {
    const buckets: PaymentRowGroups = {
      ...emptyBuckets(),
      overdueUnpaid: [paymentRow({ id: 'netflix', recurringGroupId: 'g1', date: farPast })],
    };

    const sections = buildDashboardSections(buckets, [recurringGroup()]);

    expect(sections.overdue.groups).toHaveLength(1);
    expect(sections.overdue.rows).toHaveLength(0);
    expect(sections.upcoming.groups).toHaveLength(0);
  });

  it("gathers a group's members across buckets and places the header by their combined status", () => {
    const buckets: PaymentRowGroups = {
      overdueUnpaid: [],
      upcomingUnpaid: [
        paymentRow({ id: 'disney', recurringGroupId: 'g1', paid: false, date: farFuture }),
      ],
      completedThisCycle: [paymentRow({ id: 'netflix', recurringGroupId: 'g1', paid: true })],
    };

    const sections = buildDashboardSections(buckets, [recurringGroup()]);

    // Disney still unpaid (and not overdue) -> the whole group sits in
    // "upcoming", carrying both members, not just the unpaid one.
    expect(sections.upcoming.groups).toHaveLength(1);
    expect(sections.upcoming.groups[0].members.map((m) => m.id).sort()).toEqual([
      'disney',
      'netflix',
    ]);
    expect(sections.completed.groups).toHaveLength(0);
  });

  it('treats members of a group missing from activeGroups (e.g. archived/trashed, already filtered by the caller) as plain ungrouped rows', () => {
    const buckets: PaymentRowGroups = {
      ...emptyBuckets(),
      upcomingUnpaid: [paymentRow({ id: 'netflix', recurringGroupId: 'g1' })],
    };

    // The hook (use-payments-dashboard.ts) filters to lifecycleState ===
    // 'active' before calling this — an empty activeGroups list here
    // simulates a member whose group is archived/trashed.
    const sections = buildDashboardSections(buckets, []);

    expect(sections.upcoming.groups).toHaveLength(0);
    expect(sections.upcoming.rows.map((row) => row.id)).toEqual(['netflix']);
  });

  it('ignores income rows even if recurringGroupId were somehow set', () => {
    const buckets: PaymentRowGroups = {
      ...emptyBuckets(),
      upcomingUnpaid: [paymentRow({ id: 'salary', direction: 'income', recurringGroupId: 'g1' })],
    };

    const sections = buildDashboardSections(buckets, [recurringGroup()]);

    expect(sections.upcoming.groups).toHaveLength(0);
    expect(sections.upcoming.rows.map((row) => row.id)).toEqual(['salary']);
  });
});

// The Expenses tab's flat-list equivalent of buildDashboardSections — no
// bucket concept, so these cases focus on its own { rows, groups } shape
// rather than re-testing groupBucket/computeGroupSubtotal, already covered
// above via the shared gatherMembersByGroupId helper.
describe('groupRowsIntoSections', () => {
  it("folds a group's members into one section, removed from the plain rows list", () => {
    const rows = [
      paymentRow({
        id: 'netflix',
        name: 'Netflix',
        recurringGroupId: 'g1',
        amountInDefaultCurrency: 50,
      }),
      paymentRow({
        id: 'disney',
        name: 'Disney+',
        recurringGroupId: 'g1',
        amountInDefaultCurrency: 30,
      }),
      paymentRow({ id: 'standalone', name: 'Groceries', recurringGroupId: null }),
    ];

    const result = groupRowsIntoSections(rows, [recurringGroup()]);

    expect(result.rows.map((row) => row.id)).toEqual(['standalone']);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ groupId: 'g1', name: 'Suscripciones', subtotal: 80 });
    expect(result.groups[0].members.map((m) => m.id)).toEqual(['netflix', 'disney']);
  });

  it('returns no groups when nothing is grouped', () => {
    const rows = [paymentRow({ id: 'standalone', recurringGroupId: null })];

    const result = groupRowsIntoSections(rows, [recurringGroup()]);

    expect(result.groups).toHaveLength(0);
    expect(result.rows.map((row) => row.id)).toEqual(['standalone']);
  });

  it('treats members of a group missing from activeGroups (e.g. archived/trashed) as plain rows', () => {
    const rows = [paymentRow({ id: 'netflix', recurringGroupId: 'g1' })];

    const result = groupRowsIntoSections(rows, []);

    expect(result.groups).toHaveLength(0);
    expect(result.rows.map((row) => row.id)).toEqual(['netflix']);
  });

  it('handles multiple active groups independently', () => {
    const rows = [
      paymentRow({ id: 'netflix', recurringGroupId: 'g1', amountInDefaultCurrency: 50 }),
      paymentRow({ id: 'internet', recurringGroupId: 'g2', amountInDefaultCurrency: 40 }),
    ];
    const groups = [
      recurringGroup({ id: 'g1', name: 'Suscripciones' }),
      recurringGroup({ id: 'g2', name: 'Servicios' }),
    ];

    const result = groupRowsIntoSections(rows, groups);

    expect(result.rows).toHaveLength(0);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find((g) => g.groupId === 'g1')).toMatchObject({
      name: 'Suscripciones',
      subtotal: 50,
    });
    expect(result.groups.find((g) => g.groupId === 'g2')).toMatchObject({
      name: 'Servicios',
      subtotal: 40,
    });
  });
});
