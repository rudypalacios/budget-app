import { categoryDisplayName } from './category-display';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { Category } from '@/types/firestore';

// Stage 18 follow-up (drag-and-drop grouping) — pure logic only, no
// gesture/animation code, so the actual drop-decision math and collision
// detection are unit-testable independent of react-native-gesture-handler/
// reanimated. See src/hooks/use-row-drag-and-drop.ts for the orchestration
// that calls these from real gesture events.
//
// Generic over GroupableItem rather than hard-typed to PaymentRow — three
// call sites now need the exact same collision/drop-resolution/subtotal
// math (the Payments Dashboard, the Expenses tab's "Una vez" one-time
// section, and its "Recurrentes" section, whose rows are RecurringExpense
// *definitions*, not payment rows: no paid/date/skipped, and a definition
// is never "paid" itself). All three only ever need these four fields, so
// that's the whole contract — no adapter classes needed, both PaymentRow
// and a RecurringExpense (plus a computed amountInDefaultCurrency) satisfy
// this structurally.
export type GroupableItem = {
  id: string;
  categoryId: string;
  amountInDefaultCurrency: number;
  recurringGroupId: string | null;
};

// If both rows share a category, suggest that category's name for a new
// group (e.g. two "Streaming" bills → suggest "Streaming"); otherwise no
// suggestion — the caller falls back to a translated default ("New group"),
// kept out of this function so it stays free of i18n.
export function suggestGroupName<T extends GroupableItem>(
  rowA: T,
  rowB: T,
  categories: WithId<Category>[],
): string | null {
  if (rowA.categoryId !== rowB.categoryId) return null;
  const category = categories.find((c) => c.id === rowA.categoryId);
  return category ? categoryDisplayName(category) : null;
}

export type DropTarget<T extends GroupableItem> =
  | { kind: 'row'; row: T }
  | { kind: 'groupHeader'; groupId: string }
  | { kind: 'outsideGroup' };

// The bounds-registry id a group header registers itself under (see
// GroupHeaderRow/useRowDragAndDrop's registerTarget) — a shared helper so
// every screen computing "is this group's header the current drop target"
// uses the exact same string convention rather than re-deriving it.
export function groupDropTargetId(groupId: string): string {
  return `group:${groupId}`;
}

export type DropAction =
  | { type: 'createGroup'; otherRowId: string }
  | { type: 'assignToGroup'; groupId: string }
  | { type: 'clearGroup' }
  | { type: 'noop' };

// Every action only ever mutates the *dragged* row's own recurringGroupId
// (a single store write, or none) — dropping a grouped row onto an
// ungrouped one always forms a fresh group with the target rather than
// also reassigning the target's own group, so this never needs to touch
// more than one document. Matches the drop semantics confirmed with the
// user:
// - drop on an ungrouped row -> form a new group with it (createGroup)
// - drop on any row that's already in a group, or on that group's header
//   -> join that group directly (assignToGroup) — already being in a
//   *different* group is not a special case, the dragged row just moves
// - drop outside any row/group while currently grouped -> leave the group
//   (clearGroup); outside while already ungrouped, or no target at all,
//   or dropped back on itself -> noop
//
// No longer checks anything like "is this row groupable" (e.g. the old
// expense-vs-income guard) — that's the registration side's job now (only
// ever register a valid drop target in the first place), so this function
// can trust whatever DropTarget it's handed.
export function resolveDropAction<T extends GroupableItem>(dragged: T, target: DropTarget<T> | null): DropAction {
  if (!target) return { type: 'noop' };

  if (target.kind === 'outsideGroup') {
    return dragged.recurringGroupId ? { type: 'clearGroup' } : { type: 'noop' };
  }

  if (target.kind === 'groupHeader') {
    return dragged.recurringGroupId === target.groupId
      ? { type: 'noop' }
      : { type: 'assignToGroup', groupId: target.groupId };
  }

  // target.kind === 'row' — dropping on itself is never meaningful.
  const { row } = target;
  if (row.id === dragged.id) return { type: 'noop' };

  if (row.recurringGroupId) {
    return dragged.recurringGroupId === row.recurringGroupId
      ? { type: 'noop' }
      : { type: 'assignToGroup', groupId: row.recurringGroupId };
  }

  return { type: 'createGroup', otherRowId: row.id };
}

export type Rect = { x: number; y: number; width: number; height: number };

// Point-in-rect collision, checked against every registered row/target
// bound except the one currently being dragged. Rows never overlap
// visually in this vertical list, so at most one match is expected —
// iteration order over `bounds` is irrelevant.
export function findRowUnderPoint(
  point: { x: number; y: number },
  bounds: Map<string, Rect>,
  excludeId: string,
): string | null {
  for (const [id, rect] of bounds) {
    if (id === excludeId) continue;
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
      return id;
    }
  }
  return null;
}
