import { useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { DragHandle } from '@/components/ui/drag-handle';
import { useTheme } from '@/hooks/use-theme';
import type { RowDragAndDrop } from '@/hooks/use-row-drag-and-drop';
import type { GroupableItem } from '@/lib/drag-drop-groups';

type DraggableRowContainerProps<T extends GroupableItem> = {
  item: T;
  dragAndDrop: RowDragAndDrop<T>;
  // Whether this row can participate in grouping at all — governs both
  // whether the drag handle renders (can be a drag *source*) and whether
  // this row registers itself as a drop target (can be a drag
  // *destination*). A single flag because on every current call site the
  // two are the same condition (e.g. the Dashboard's income rows are
  // neither); resolveDropAction (src/lib/drag-drop-groups.ts) no longer
  // checks this itself, so registration is the only place left that
  // decides it.
  groupable: boolean;
  dragHandleAccessibilityLabel: string;
  isDropTarget: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// Stage 18 follow-up (drag-and-drop grouping), generalized for the
// Expenses-grouping follow-up — the reusable drag-registration/lift-
// animation/handle shell shared by every draggable row type (PaymentRow on
// the Dashboard and the Expenses tab's "Una vez" section,
// RecurringExpense-definition rows on its "Recurrentes" section). A real
// component (not a plain render function) because
// react-native-reanimated's useAnimatedStyle can't be called from inside a
// .map() callback (Rules of Hooks) — callers must already be real
// components themselves for the same reason.
//
// Unregistration on unmount is deliberately not handled here — same as
// before this was extracted, a stale bounds entry for a row that's since
// disappeared (e.g. it moved buckets after being paid) is simply
// overwritten the next time a row with that id lays out again, never
// cleaned up eagerly. Harmless: findRowUnderPoint is only ever consulted
// during an active drag.
export function DraggableRowContainer<T extends GroupableItem>({
  item,
  dragAndDrop,
  groupable,
  dragHandleAccessibilityLabel,
  isDropTarget,
  style,
  children,
}: DraggableRowContainerProps<T>) {
  const theme = useTheme();
  const outerRef = useRef<View>(null);

  function handleLayout() {
    if (!groupable) return;
    outerRef.current?.measureInWindow((x, y, width, height) => {
      dragAndDrop.registerTarget(item.id, { x, y, width, height }, { kind: 'row', row: item });
    });
  }

  const animatedStyle = useAnimatedStyle(() => {
    const isDragging = dragAndDrop.draggedRowIdShared.value === item.id;
    return {
      transform: isDragging
        ? [
            { translateX: dragAndDrop.translateX.value },
            { translateY: dragAndDrop.translateY.value },
            { scale: 1.03 },
          ]
        : [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      zIndex: isDragging ? 10 : 0,
      shadowOpacity: isDragging ? 0.2 : 0,
      elevation: isDragging ? 6 : 0,
    };
  });

  return (
    <View ref={outerRef} onLayout={handleLayout}>
      <Animated.View
        style={[
          style,
          animatedStyle,
          // The border-bottom is the primary "drop here" marker — set with
          // its own width/color rather than relying on a row's own base
          // `style` already having a borderWidth (some row types, e.g.
          // RecurringDefinitionRowItem, don't), so every row type gets a
          // visible indicator regardless of its own border styling. Layered
          // with the translucent tint wash, not a replacement for it.
          isDropTarget && {
            backgroundColor: `${theme.tint}26`,
            borderBottomWidth: 3,
            borderBottomColor: theme.tint,
          },
        ]}
      >
        {groupable && (
          <DragHandle
            accessibilityLabel={dragHandleAccessibilityLabel}
            onDragStart={() => dragAndDrop.handleDragStart(item)}
            onDragUpdate={dragAndDrop.handleDragUpdate}
            onDragEnd={dragAndDrop.handleDragEnd}
          />
        )}
        {children}
      </Animated.View>
    </View>
  );
}
