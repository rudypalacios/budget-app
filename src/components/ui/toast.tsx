import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing, TopBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hideToast, useToastStore } from '@/store/toast';

// Mounted once at the app root (src/app/_layout.tsx) so any screen can call
// showToast() without rendering anything itself. Renders nothing when there's
// no active message.
//
// Deliberately anchored at different edges per platform (fix/ux-polish-round-3,
// explicit user request reversing the original top-only placement): bottom
// on native, clearing the tab bar via the same BottomTabInset constant
// already used elsewhere for that purpose; top on web, below the floating
// pill nav via TopBarInset, since web has no bottom tab bar to collide with.
const positionStyle = Platform.select({
  web: { top: TopBarInset + Spacing.two },
  default: { bottom: BottomTabInset + Spacing.two },
});

export function Toast() {
  const theme = useTheme();
  const message = useToastStore((state) => state.message);

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
