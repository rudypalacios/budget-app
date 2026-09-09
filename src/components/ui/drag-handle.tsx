import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { MinTouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DragHandleProps = {
  accessibilityLabel: string;
  onDragStart: () => void;
  // translationX/Y are relative to the gesture's start (for animating the
  // dragged row's own lift/offset). absoluteX/Y are the pointer's position
  // in the screen's coordinate space (matches what react-native's
  // onLayout/measureInWindow already report elsewhere, e.g. Select's
  // FloatingPanel anchor) — the caller resolves this against its own
  // bounds registry via src/lib/drag-drop-groups.ts's findRowUnderPoint.
  onDragUpdate: (translationX: number, translationY: number, absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
};

// Stage 18 follow-up (drag-and-drop grouping) — the explicit grip icon
// confirmed with the user for *both* web and native (not long-press
// anywhere on the row, which fights with mouse text-selection/scroll on
// web). Purely a gesture-capture + icon: it owns no animated style of its
// own and no group-domain knowledge — the row component that renders this
// owns the actual lift/highlight animation and the drop-decision logic
// (src/hooks/use-row-drag-and-drop.ts), so this stays a small, reusable
// primitive rather than baking in Dashboard-specific behavior.
export function DragHandle({ accessibilityLabel, onDragStart, onDragUpdate, onDragEnd }: DragHandleProps) {
  const theme = useTheme();

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      runOnJS(onDragUpdate)(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    })
    .onEnd(() => {
      runOnJS(onDragEnd)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" style={styles.handle}>
        <SymbolView
          name={{ ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' }}
          size={16}
          tintColor={theme.textSecondary}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
