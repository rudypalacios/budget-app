import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing, TopBarInset, WebBottomNavHeight } from '@/constants/theme';
import { useIsCompactWebNav } from '@/hooks/use-nav-layout';
import { useTheme } from '@/hooks/use-theme';
import { hideToast, useToastStore } from '@/store/toast';

// Mounted once at the app root (src/app/_layout.tsx) so any screen can call
// showToast() without rendering anything itself. Renders nothing when there's
// no active message.
//
// Deliberately anchored at different edges per platform (fix/ux-polish-round-3,
// explicit user request reversing the original top-only placement): bottom
// on native, clearing the tab bar via the same BottomTabInset constant
// already used elsewhere for that purpose; top on wide web, below the
// floating pill nav via TopBarInset. Compact web now has its own bottom
// WebBottomTabBar (app-tabs.web.tsx) instead of that pill, so it anchors at
// the bottom too, same as native.
function usePositionStyle() {
  const isCompactWebNav = useIsCompactWebNav();
  if (Platform.OS !== 'web') {
    return { bottom: BottomTabInset + Spacing.two };
  }
  return isCompactWebNav
    ? { bottom: WebBottomNavHeight + Spacing.two }
    : { top: TopBarInset + Spacing.two };
}

export function Toast() {
  const theme = useTheme();
  const message = useToastStore((state) => state.message);
  const positionStyle = usePositionStyle();

  if (!message) return null;

  return (
    <Pressable
      onPress={hideToast}
      accessibilityRole="alert"
      style={[styles.container, positionStyle, { backgroundColor: theme.text }]}
    >
      <ThemedText type="smallBold" style={{ color: theme.background }}>
        {message}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
