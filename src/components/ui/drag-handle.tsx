import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

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

// The Material Symbols "drag_indicator" glyph (2x3 dot grid) — drawn via
// react-native-svg (already a project dependency, Stage 5) rather than a
// per-platform SymbolView lookup, so the icon is pixel-identical on iOS,
// Android, and web. SF Symbols has no equivalent 6-dot grip glyph (Apple's
// own reordering UI uses a 3-line hamburger instead), and this feature's
// confirmed UX decision was one consistent handle look on every platform.
// Path data is verbatim from Google's material-design-icons source
// (symbols/web/drag_indicator/materialsymbolsoutlined/drag_indicator_24px.svg).
function DragIndicatorIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 -960 960 960">
      <Path
        d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"
        fill={color}
      />
    </Svg>
  );
}

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
  const [isDragging, setIsDragging] = useState(false);

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(setIsDragging)(true);
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      runOnJS(onDragUpdate)(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    })
    .onEnd(() => {
      runOnJS(setIsDragging)(false);
      runOnJS(onDragEnd)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        style={[
          styles.handle,
          // 'grab'/'grabbing' aren't in RN core's CursorValue type ('auto' |
          // 'pointer' only, see StyleSheetTypes.d.ts) even though
          // react-native-web passes the value straight through to CSS
          // `cursor`, which does support them — a narrow cast is the only
          // way to express this. No-op on native (no mouse pointer there).
          { cursor: isDragging ? 'grabbing' : 'grab' } as unknown as ViewStyle,
        ]}
      >
        <DragIndicatorIcon color={theme.textSecondary} />
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
