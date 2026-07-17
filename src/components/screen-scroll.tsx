import { type PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BottomTabInset, MaxContentWidth, Spacing, TopBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScreenScrollProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  // Opt-in pull-to-refresh — omit on screens where a refresh gesture
  // wouldn't make sense (e.g. forms). Firestore's onSnapshot listeners are
  // already always live (see useSyncStatus), so this is a visual "yes, I
  // heard you, here's the current state" affordance, not a new fetch path.
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

// Shared screen shell: a full-bleed themed background (the screen itself),
// with a max-width content column centered inside a ScrollView. Keeping the
// background on this outer wrapper — not the max-width column — matters:
// putting it on the narrower column left the browser's own background
// showing through on either side on wide viewports.
export function ScreenScroll({ children, contentStyle, refreshing, onRefresh }: ScreenScrollProps) {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={theme.tint} />
          ) : undefined
        }
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </ScrollView>
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
    paddingTop: Spacing.four + TopBarInset,
    paddingBottom: Spacing.four + BottomTabInset,
    gap: Spacing.four,
  },
});
