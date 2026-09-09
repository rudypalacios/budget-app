import { findRowUnderPoint, resolveDropAction, suggestGroupName, type Rect } from './drag-drop-groups';
import type { PaymentRow } from './payments-dashboard';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { Category } from '@/types/firestore';

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'row-1',
    direction: 'expense',
    kind: 'oneTime',
    name: 'Netflix',
    categoryId: 'cat-1',
    date: new Date(2026, 8, 1),
    amount: 50,
    currency: 'GTQ',
    amountInDefaultCurrency: 50,
    paid: false,
    paidDate: null,
    skipped: false,
    skippedAt: null,
    recurringGroupId: null,
    ...overrides,
  };
}

function category(overrides: Partial<WithId<Category>> = {}): WithId<Category> {
  return {
    id: 'cat-1',
    name: 'Suscripciones',
    type: 'expense',
    color: null,
    icon: null,
    order: 0,
    isSystemDefault: false,
    lifecycleState: 'active',
    monthlyBudget: null,
    createdAt: null as never,
    updatedAt: null as never,
    ...overrides,
  };
}

describe('suggestGroupName', () => {
  it('suggests the shared category name when both rows are in the same category', () => {
    const rowA = paymentRow({ id: 'a', categoryId: 'cat-1' });
    const rowB = paymentRow({ id: 'b', categoryId: 'cat-1' });

    expect(suggestGroupName(rowA, rowB, [category({ id: 'cat-1', name: 'Suscripciones' })])).toBe('Suscripciones');
  });

  it('includes the category icon, same as categoryDisplayName elsewhere', () => {
    const rowA = paymentRow({ id: 'a', categoryId: 'cat-1' });
    const rowB = paymentRow({ id: 'b', categoryId: 'cat-1' });

    expect(
      suggestGroupName(rowA, rowB, [category({ id: 'cat-1', name: 'Suscripciones', icon: '📺' })]),
    ).toBe('📺 Suscripciones');
  });

  it('returns null when the two rows are in different categories', () => {
    const rowA = paymentRow({ id: 'a', categoryId: 'cat-1' });
    const rowB = paymentRow({ id: 'b', categoryId: 'cat-2' });

    expect(suggestGroupName(rowA, rowB, [category({ id: 'cat-1' }), category({ id: 'cat-2' })])).toBeNull();
  });

  it('returns null when the shared category is not found (defensive)', () => {
    const rowA = paymentRow({ id: 'a', categoryId: 'cat-missing' });
    const rowB = paymentRow({ id: 'b', categoryId: 'cat-missing' });

    expect(suggestGroupName(rowA, rowB, [])).toBeNull();
  });
});

describe('resolveDropAction', () => {
  const dragged = paymentRow({ id: 'dragged', recurringGroupId: null });

  it('returns noop when there is no drop target', () => {
    expect(resolveDropAction(dragged, null)).toEqual({ type: 'noop' });
  });

  it('creates a new group when dropped on an ungrouped row', () => {
    const target = { kind: 'row' as const, row: paymentRow({ id: 'target', recurringGroupId: null }) };
    expect(resolveDropAction(dragged, target)).toEqual({ type: 'createGroup', otherRowId: 'target' });
  });

  it('joins the target row\'s existing group when dropped on an already-grouped row', () => {
    const target = { kind: 'row' as const, row: paymentRow({ id: 'target', recurringGroupId: 'g1' }) };
    expect(resolveDropAction(dragged, target)).toEqual({ type: 'assignToGroup', groupId: 'g1' });
  });

  it('is a noop when dropped on a row already in the same group as the dragged row', () => {
    const draggedInGroup = paymentRow({ id: 'dragged', recurringGroupId: 'g1' });
    const target = { kind: 'row' as const, row: paymentRow({ id: 'target', recurringGroupId: 'g1' }) };
    expect(resolveDropAction(draggedInGroup, target)).toEqual({ type: 'noop' });
  });

  it('is a noop when the target row is dropped on itself', () => {
    const target = { kind: 'row' as const, row: dragged };
    expect(resolveDropAction(dragged, target)).toEqual({ type: 'noop' });
  });

  it('is a noop when the target row is income (grouping is expense-only)', () => {
    const target = { kind: 'row' as const, row: paymentRow({ id: 'target', direction: 'income' }) };
    expect(resolveDropAction(dragged, target)).toEqual({ type: 'noop' });
  });

  it('joins the group directly when dropped on a group header', () => {
    expect(resolveDropAction(dragged, { kind: 'groupHeader', groupId: 'g1' })).toEqual({
      type: 'assignToGroup',
      groupId: 'g1',
    });
  });

  it('is a noop when dropped on its own group\'s header', () => {
    const draggedInGroup = paymentRow({ id: 'dragged', recurringGroupId: 'g1' });
    expect(resolveDropAction(draggedInGroup, { kind: 'groupHeader', groupId: 'g1' })).toEqual({ type: 'noop' });
  });

  it('moves the dragged row to a different group\'s header even if already grouped elsewhere', () => {
    const draggedInGroup = paymentRow({ id: 'dragged', recurringGroupId: 'g1' });
    expect(resolveDropAction(draggedInGroup, { kind: 'groupHeader', groupId: 'g2' })).toEqual({
      type: 'assignToGroup',
      groupId: 'g2',
    });
  });

  it('clears the group when a grouped row is dropped outside any group', () => {
    const draggedInGroup = paymentRow({ id: 'dragged', recurringGroupId: 'g1' });
    expect(resolveDropAction(draggedInGroup, { kind: 'outsideGroup' })).toEqual({ type: 'clearGroup' });
  });

  it('is a noop when an already-ungrouped row is dropped outside any group', () => {
    expect(resolveDropAction(dragged, { kind: 'outsideGroup' })).toEqual({ type: 'noop' });
  });
});

describe('findRowUnderPoint', () => {
  function rect(x: number, y: number, width = 100, height = 50): Rect {
    return { x, y, width, height };
  }

  it('finds the row whose bounds contain the point', () => {
    const bounds = new Map<string, Rect>([
      ['a', rect(0, 0)],
      ['b', rect(0, 60)],
    ]);
    expect(findRowUnderPoint({ x: 10, y: 70 }, bounds, 'excluded')).toBe('b');
  });

  it('returns null when the point is outside every rect', () => {
    const bounds = new Map<string, Rect>([['a', rect(0, 0)]]);
    expect(findRowUnderPoint({ x: 500, y: 500 }, bounds, 'excluded')).toBeNull();
  });

  it('excludes the dragged row itself even if the point is within its own bounds', () => {
    const bounds = new Map<string, Rect>([['dragged', rect(0, 0)]]);
    expect(findRowUnderPoint({ x: 10, y: 10 }, bounds, 'dragged')).toBeNull();
  });

  it('treats the rect edges as inclusive', () => {
    const bounds = new Map<string, Rect>([['a', rect(0, 0, 100, 50)]]);
    expect(findRowUnderPoint({ x: 100, y: 50 }, bounds, 'excluded')).toBe('a');
  });
});
