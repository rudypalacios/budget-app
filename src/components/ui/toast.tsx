import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hideToast, useToastStore } from '@/store/toast';

// Mounted once at the app root (src/app/_layout.tsx) so any screen can call
// showToast() without rendering anything itself. Renders nothing when there's
// no active message.
export function Toast() {
  const theme = useTheme();
  const message = useToastStore((state) => state.message);

  if (!message) return null;

  return (
    <Pressable
      onPress={hideToast}
      accessibilityRole="alert"
      style={[styles.container, { bottom: BottomTabInset + Spacing.three, backgroundColor: theme.text }]}
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
