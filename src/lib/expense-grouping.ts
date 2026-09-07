// Pure logic for Stage 18 expense grouping (FR-21–FR-21g, data-model.md
// §11) — kept free of Firestore imports so it's directly unit-testable,
// same lib/-vs-store/ split as lifecycle-transitions.ts. Orchestration
// (actually writing parentExpenseId/paid to Firestore) lives in
// src/store/expenses.ts.

type GroupableRecord = {
  id: string;
  parentExpenseId: string | null;
  lifecycleState: string;
};

// FR-21b: a group's cascade only ever considers *active* children — an
// archived/trashed child can't permanently block its parent from reading
// as paid, and a parent action shouldn't reach into an archived/trashed
// child either.
export function findActiveChildren<T extends GroupableRecord>(items: T[], parentId: string): T[] {
  return items.filter((item) => item.parentExpenseId === parentId && item.lifecycleState === 'active');
}

// FR-21d: informational subtotal only — never written back to any field.
export function computeGroupedSubtotal(children: { amountInDefaultCurrency: number }[]): number {
  return children.reduce((sum, child) => sum + child.amountInDefaultCurrency, 0);
}

// FR-21a: grouping is single-level. `candidateParentId` is a valid parent
// for `childId` only if it isn't itself already a child, and `childId`
// doesn't already have children of its own (which would make it a parent
// two levels down from whoever it joins).
export function canGroupUnder<T extends GroupableRecord>(
  items: T[],
  childId: string,
  candidateParentId: string,
): boolean {
  if (childId === candidateParentId) return false;
  const candidateParent = items.find((item) => item.id === candidateParentId);
  if (!candidateParent || candidateParent.parentExpenseId !== null) return false;
  const childHasOwnChildren = items.some((item) => item.parentExpenseId === childId);
  return !childHasOwnChildren;
}

// Picker source list (FR-21, path 1 — the ad hoc "Add to group" action):
// every other active, ungrouped expense — empty when `childId` itself
// already has children (it can't become a child without breaking the
// single-level rule above).
export function eligibleGroupParents<T extends GroupableRecord>(items: T[], childId: string): T[] {
  const childHasOwnChildren = items.some((item) => item.parentExpenseId === childId);
  if (childHasOwnChildren) return [];
  return items.filter(
    (item) => item.id !== childId && item.lifecycleState === 'active' && item.parentExpenseId === null,
  );
}

// FR-21b: tri-state "select-all checkbox" math — a parent reads as paid
// only when every one of its active children is paid. Only meaningful when
// `children` is non-empty; callers must not invoke this for a childless
// parent (its own `paid` field stays whatever the user last set directly).
// `override` lets a caller supply the value it is about to write for one
// specific child without re-reading that write back from a possibly-stale
// store snapshot (see expenses.ts's setExpensePaid/setExpenseGroupParent).
export function computeParentPaidFromChildren<T extends { id: string; paid: boolean }>(
  children: T[],
  override?: { id: string; paid: boolean },
): boolean {
  return children.every((child) => (override && child.id === override.id ? override.paid : child.paid));
}
