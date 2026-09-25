import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MinTouchTarget, Spacing, TopBarInset, WebBottomNavHeight } from '@/constants/theme';
import { useIsCompactWebNav } from '@/hooks/use-nav-layout';
import { useTheme } from '@/hooks/use-theme';
import { hideToast, runToastAction, useToastStore } from '@/store/toast';

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
  const { t } = useTranslation();
  const theme = useTheme();
  const message = useToastStore((state) => state.message);
  const actions = useToastStore((state) => state.actions);
  const positionStyle = usePositionStyle();

  if (!message) return null;

  const surface = [styles.container, positionStyle, { backgroundColor: theme.text }];

  // Informational toast: unchanged — tap anywhere to dismiss early.
  if (actions.length === 0) {
    return (
      <Pressable onPress={hideToast} accessibilityRole="alert" accessibilityLiveRegion="polite" style={surface}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {message}
        </ThemedText>
      </Pressable>
    );
  }

  // Toast with actions (fase 7): stays until an action or ✕ is pressed, so
  // the message itself is no longer a dismiss target — only those are.
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[surface, styles.withActions]}>
      <View style={styles.messageRow}>
        <ThemedText type="smallBold" style={[styles.message, { color: theme.background }]}>
          {message}
        </ThemedText>
        <Pressable
          onPress={hideToast}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.closeButton}
        >
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor={theme.background} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => runToastAction(action)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
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
  // Wide enough that two actions never get squeezed.
  withActions: {
    width: 440,
    paddingBottom: Spacing.one,
    gap: Spacing.one,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  message: {
    flex: 1,
  },
  closeButton: {
    minWidth: MinTouchTarget / 2,
    alignItems: 'center',
    paddingTop: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
