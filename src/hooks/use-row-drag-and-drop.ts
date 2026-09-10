import { useRef, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';

import {
  findRowUnderPoint,
  resolveDropAction,
  type DropAction,
  type DropTarget,
  type GroupableItem,
  type Rect,
} from '@/lib/drag-drop-groups';

// Stage 18 follow-up (drag-and-drop grouping) — owns the gesture/geometry
// side of the drag-to-group interaction: a bounds registry (every
// draggable row and group header registers its measured on-screen rect via
// onLayout/measureInWindow), the currently-dragged row's visual offset
// (shared values, read by each row's own useAnimatedStyle), and which
// target is currently under the pointer (plain state — the highlight
// doesn't need worklet-level smoothness). The *domain* decision (what a
// drop actually means) is src/lib/drag-drop-groups.ts's pure
// resolveDropAction; the *domain* action (which store calls to make, or
// opening the name dialog for a new group) is left entirely to
// onDropResolved's caller — this hook never calls a store function itself.
//
// Generic over GroupableItem rather than hard-typed to PaymentRow — reused
// by the Payments Dashboard, and (Expenses-tab grouping follow-up) the
// Expenses tab's "Una vez" (PaymentRow-shaped) and "Recurrentes"
// (RecurringExpense-definition-shaped) sections, via
// src/hooks/use-group-drag-orchestration.ts.
//
// A drop with nothing under the pointer resolves to `{ kind:
// 'outsideGroup' }` rather than a separate registered "outside" zone —
// resolveDropAction already treats that as "leave the current group if
// there is one, else no-op", which is exactly the drag-a-member-out
// behavior without needing to track group-card boundaries separately.
export function useRowDragAndDrop<T extends GroupableItem>(onDropResolved: (draggedRow: T, action: DropAction) => void) {
  const boundsRef = useRef(new Map<string, Rect>());
  const targetsRef = useRef(new Map<string, DropTarget<T>>());
  const draggedRowRef = useRef<T | null>(null);

  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  // The dragged row's id, readable from worklet context — each row's
  // useAnimatedStyle reads this (a plain useState wouldn't be safe to read
  // from a worklet) to decide whether translateX/Y apply to it
  // specifically, since every row shares the same one pair of values.
  const draggedRowIdShared = useSharedValue<string | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  function registerTarget(id: string, rect: Rect, target: DropTarget<T>) {
    boundsRef.current.set(id, rect);
    targetsRef.current.set(id, target);
  }

  function handleDragStart(row: T) {
    draggedRowRef.current = row;
    draggedRowIdShared.value = row.id;
    translateX.value = 0;
    translateY.value = 0;
  }

  function handleDragUpdate(translationX: number, translationY: number, absoluteX: number, absoluteY: number) {
    translateX.value = translationX;
    translateY.value = translationY;
    const draggedId = draggedRowRef.current?.id;
    if (!draggedId) return;
    setHoveredTargetId(findRowUnderPoint({ x: absoluteX, y: absoluteY }, boundsRef.current, draggedId));
  }

  function handleDragEnd() {
    const draggedRow = draggedRowRef.current;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    draggedRowIdShared.value = null;

    if (draggedRow) {
      const hitTarget = hoveredTargetId ? (targetsRef.current.get(hoveredTargetId) ?? null) : null;
      const target: DropTarget<T> | null = hitTarget ?? (draggedRow.recurringGroupId ? { kind: 'outsideGroup' } : null);
      onDropResolved(draggedRow, resolveDropAction(draggedRow, target));
    }

    draggedRowRef.current = null;
    setHoveredTargetId(null);
  }

  return {
    registerTarget,
    hoveredTargetId,
    draggedRowIdShared,
    translateX,
    translateY,
    handleDragStart,
    handleDragUpdate,
    handleDragEnd,
  };
}

export type RowDragAndDrop<T extends GroupableItem> = ReturnType<typeof useRowDragAndDrop<T>>;
