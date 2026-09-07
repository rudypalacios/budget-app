import {
  canGroupUnder,
  computeGroupedSubtotal,
  computeParentPaidFromChildren,
  eligibleGroupParents,
  findActiveChildren,
} from './expense-grouping';

type FakeExpense = {
  id: string;
  parentExpenseId: string | null;
  lifecycleState: 'active' | 'archived' | 'trashed';
  paid: boolean;
  amountInDefaultCurrency: number;
};

function expense(overrides: Partial<FakeExpense> & { id: string }): FakeExpense {
  return {
    parentExpenseId: null,
    lifecycleState: 'active',
    paid: false,
    amountInDefaultCurrency: 0,
    ...overrides,
  };
}

describe('findActiveChildren', () => {
  it('returns only active children of the given parent', () => {
    const items = [
      expense({ id: 'netflix', parentExpenseId: 'card' }),
      expense({ id: 'disney', parentExpenseId: 'card', lifecycleState: 'archived' }),
      expense({ id: 'unrelated', parentExpenseId: null }),
    ];

    expect(findActiveChildren(items, 'card').map((c) => c.id)).toEqual(['netflix']);
  });
});

describe('computeGroupedSubtotal', () => {
  it('sums amountInDefaultCurrency across children', () => {
    const children = [{ amountInDefaultCurrency: 70 }, { amountInDefaultCurrency: 60 }, { amountInDefaultCurrency: 45 }];
    expect(computeGroupedSubtotal(children)).toBe(175);
  });

  it('returns 0 for an empty list', () => {
    expect(computeGroupedSubtotal([])).toBe(0);
  });
});

describe('canGroupUnder', () => {
  it('rejects an expense being its own parent', () => {
    const items = [expense({ id: 'card' })];
    expect(canGroupUnder(items, 'card', 'card')).toBe(false);
  });

  it('rejects a candidate parent that is itself already a child (no nesting, FR-21a)', () => {
    const items = [expense({ id: 'card' }), expense({ id: 'netflix', parentExpenseId: 'card' })];
    // disney can't be grouped under netflix, since netflix is itself a child
    expect(canGroupUnder([...items, expense({ id: 'disney' })], 'disney', 'netflix')).toBe(false);
  });

  it('rejects grouping under a nonexistent expense', () => {
    const items = [expense({ id: 'netflix' })];
    expect(canGroupUnder(items, 'netflix', 'ghost')).toBe(false);
  });

  it('rejects making a parent (something with its own children) into a child', () => {
    const items = [
      expense({ id: 'card' }),
      expense({ id: 'netflix', parentExpenseId: 'card' }),
      expense({ id: 'other-card' }),
    ];
    // card already has a child (netflix) — grouping it under other-card would
    // create a 2-level chain (other-card -> card -> netflix).
    expect(canGroupUnder(items, 'card', 'other-card')).toBe(false);
  });

  it('allows grouping under an ordinary active, ungrouped expense', () => {
    const items = [expense({ id: 'card' }), expense({ id: 'netflix' })];
    expect(canGroupUnder(items, 'netflix', 'card')).toBe(true);
  });
});

describe('eligibleGroupParents', () => {
  it('excludes the expense itself, children, and already-grouped-as-child items', () => {
    const items = [
      expense({ id: 'netflix' }),
      expense({ id: 'card' }),
      expense({ id: 'disney', parentExpenseId: 'card' }),
      expense({ id: 'trashed-card', lifecycleState: 'trashed' }),
    ];

    expect(eligibleGroupParents(items, 'netflix').map((e) => e.id).sort()).toEqual(['card']);
  });

  it('returns an empty list when the expense already has its own children', () => {
    const items = [
      expense({ id: 'card' }),
      expense({ id: 'netflix', parentExpenseId: 'card' }),
      expense({ id: 'other' }),
    ];
    expect(eligibleGroupParents(items, 'card')).toEqual([]);
  });
});

describe('computeParentPaidFromChildren', () => {
  it('is true only when every child is paid', () => {
    const allPaid = [{ id: 'a', paid: true }, { id: 'b', paid: true }];
    const notAllPaid = [{ id: 'a', paid: true }, { id: 'b', paid: false }];
    expect(computeParentPaidFromChildren(allPaid)).toBe(true);
    expect(computeParentPaidFromChildren(notAllPaid)).toBe(false);
  });

  it('applies the override instead of the stale value for the child being changed', () => {
    const children = [{ id: 'a', paid: false }, { id: 'b', paid: true }];
    // a is about to become paid — override says so even though the snapshot
    // above still shows it unpaid (mirrors reading store state before the
    // write that triggered this recompute has landed).
    expect(computeParentPaidFromChildren(children, { id: 'a', paid: true })).toBe(true);
    // b is about to become unpaid — same idea in the other direction.
    expect(computeParentPaidFromChildren(children, { id: 'b', paid: false })).toBe(false);
  });
});
