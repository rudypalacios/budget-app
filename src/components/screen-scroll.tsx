import { type PropsWithChildren } from 'react';
import { Platform, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';

import { BottomTabInset, MaxContentWidth, Spacing, TopBarInset, WebBottomNavHeight } from '@/constants/theme';
import { useIsCompactWebNav } from '@/hooks/use-nav-layout';
import { useTheme } from '@/hooks/use-theme';

export type ScreenScrollProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  // Opt-in pull-to-refresh — omit on screens where a refresh gesture
  // wouldn't make sense (e.g. forms). Firestore's onSnapshot listeners are
  // already always live (see useSyncStatus), so this is a visual "yes, I
  // heard you, here's the current state" affordance, not a new fetch path.
  refreshing?: boolean;
  onRefresh?: () => void;
  // Opt-in — a screen rendering a Fab (ui/fab.tsx) passes its own shared
  // value here so the scroll position drives that Fab's expand/collapse
  // animation directly on the UI thread. Screens without a Fab omit this
  // and behave exactly as before.
  scrollOffset?: SharedValue<number>;
}>;

// A plain (non-hook) worklet, not inlined into ScreenScroll's own body —
// mutating `target.value` here operates on this function's own local
// parameter binding, not on ScreenScroll's `scrollOffset` prop directly,
// which is what react-hooks/immutability (props are otherwise treated as
// read-only) actually checks for. Reanimated shared values are designed to
// be mutated via `.value` from a worklet like this one; that's the whole
// mechanism this component opts a screen's Fab into.
function assignScrollOffset(target: SharedValue<number> | undefined, y: number) {
  'worklet';
  if (target) {
    target.value = y;
  }
}

// Shared screen shell: a full-bleed themed background (the screen itself),
// with a max-width content column centered inside a ScrollView. Keeping the
// background on this outer wrapper — not the max-width column — matters:
// putting it on the narrower column left the browser's own background
// showing through on either side on wide viewports.
export function ScreenScroll({ children, contentStyle, refreshing, onRefresh, scrollOffset }: ScreenScrollProps) {
  const theme = useTheme();
  const isCompactWebNav = useIsCompactWebNav();
  const scrollHandler = useAnimatedScrollHandler((event) => {
    assignScrollOffset(scrollOffset, event.contentOffset.y);
  });
  // Web has no top pill in compact nav (WebBottomTabBar replaces it, same as
  // native never having one) but does need bottom clearance for that new bar,
  // which wide-viewport web doesn't have — the inverse of TopBarInset/
  // BottomTabInset's native split. See app-tabs.web.tsx.
  const insetStyle = {
    paddingTop: Spacing.four + (isCompactWebNav ? 0 : TopBarInset),
    paddingBottom:
      Spacing.four + (Platform.OS === 'web' ? (isCompactWebNav ? WebBottomNavHeight : 0) : BottomTabInset),
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={theme.tint} />
          ) : undefined
        }
      >
        <View style={[styles.content, insetStyle, contentStyle]}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
