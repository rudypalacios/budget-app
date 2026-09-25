import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing, WebBottomNavHeight } from '@/constants/theme';
import { useIsCompactWebNav } from '@/hooks/use-nav-layout';
import { useTheme } from '@/hooks/use-theme';

export type FabProps = {
  label: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  // The screen's own ScreenScroll scroll position (see screen-scroll.tsx's
  // optional `scrollOffset` prop) — the collapse below is driven directly
  // off this shared value rather than a discrete "past N px" callback, so
  // it tracks the scroll gesture itself frame-by-frame.
  scrollOffset: SharedValue<number>;
};

const FAB_HEIGHT = 56;
// How much scroll (px) the extended-pill-to-icon-only-circle collapse
// plays out over — a short, responsive range, matching the Gmail
// "Redactar" FAB reference the user pointed to (collapses almost
// immediately on scroll, not a slow fade over the whole list).
const COLLAPSE_RANGE = 60;
// The visible label is measured off a separate copy (see labelWidth below)
// rendered in a slightly different layout context (absolutely positioned,
// outside the row) than where it's actually displayed (inside labelClip,
// centered in a flex row) — sub-pixel rounding between the two occasionally
// left the displayed copy a pixel short of its own measured width, enough
// for numberOfLines={1} to truncate it with an ellipsis. This small buffer
// is cheaper than a second measurement pass and imperceptible visually.
const LABEL_WIDTH_BUFFER = 4;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Same bottom-clearance convention as Toast (src/components/ui/toast.tsx),
// reused rather than duplicated, but always anchored at the bottom — a FAB
// has no reason to move to the top edge the way Toast does on wide web.
function useFabBottomOffset() {
  const isCompactWebNav = useIsCompactWebNav();
  if (Platform.OS !== 'web') {
    return BottomTabInset + Spacing.three;
  }
  return isCompactWebNav ? WebBottomNavHeight + Spacing.three : Spacing.four;
}

// Floating action button replacing the old full-width top-of-screen
// primary-action Button on the Dashboard/Expenses/Income tabs, per the
// user's explicit request to follow the bottom-right FAB pattern common to
// most apps. Starts as a Gmail-"Redactar"-style extended pill (icon +
// label) and smoothly collapses into an icon-only circle once the screen
// scrolls, then re-expands back at the top — both directions are the same
// continuous animation, not a snap.
export function Fab({ label, icon, onPress, scrollOffset }: FabProps) {
  const theme = useTheme();
  const bottomOffset = useFabBottomOffset();
  // The label's own natural (unclipped) width, measured once on layout —
  // interpolated down to 0 below as the collapse progresses. Measured off
  // a separate, absolutely-positioned copy (below) rather than the visible
  // label itself: the visible one lives inside labelClip, whose own width
  // is already animated (starting at 0 pre-measurement), and RN's default
  // cross-axis stretch would otherwise squash the visible copy to that
  // same 0 width before it ever gets a chance to report its true size.
  const [labelWidth, setLabelWidth] = useState(0);

  function handleLabelLayout(event: LayoutChangeEvent) {
    setLabelWidth(event.nativeEvent.layout.width);
  }

  const pressableStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollOffset.value,
      [0, COLLAPSE_RANGE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    // Shrinks the gap after the label to 0 in lockstep with the label
    // itself, so the collapsed shape is exactly iconBox's own width — a
    // perfect circle, not a circle-plus-leftover-padding pill.
    return { paddingRight: (1 - progress) * Spacing.three };
  });

  const labelStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollOffset.value,
      [0, COLLAPSE_RANGE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      width: (1 - progress) * (labelWidth + LABEL_WIDTH_BUFFER),
      opacity: 1 - progress,
    };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.fab,
        { backgroundColor: theme.tint, right: Spacing.three, bottom: bottomOffset },
        pressableStyle,
      ]}
    >
      <View style={styles.iconBox}>
        <SymbolView name={icon} size={24} tintColor={theme.tintText} />
      </View>
      <Animated.View style={[styles.labelClip, labelStyle]}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={[styles.labelText, { color: theme.tintText }]}
        >
          {label}
        </ThemedText>
      </Animated.View>
      {/* Measurement-only copy — absolutely positioned so it never
          participates in the row's flex layout and is never affected by
          labelClip's own animated width; exists purely to report the
          label's true natural width via onLayout. */}
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        onLayout={handleLabelLayout}
        style={[styles.labelText, styles.measureOnly, { color: theme.tintText }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    height: FAB_HEIGHT,
    borderRadius: FAB_HEIGHT / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBox: {
    width: FAB_HEIGHT,
    height: FAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelClip: {
    overflow: 'hidden',
  },
  labelText: {
    // No width of its own — sized by content, so labelClip's animated
    // width is what clips it (or doesn't) rather than the Text wrapping.
    flexShrink: 0,
  },
  measureOnly: {
    position: 'absolute',
    opacity: 0,
  },
});
