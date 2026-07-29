import { useEffect, useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DrawerProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
}>;

const DRAWER_WIDTH = 280;
const ANIMATION_MS = 220;

// A full-height slide-in panel from the right edge — the "hamburger menu,
// slide-in panel" mobile nav pattern called out in docs/SRS-presupuesto-app.md
// §3. Built on RN's real Modal (see floating-panel.tsx for why: a genuine
// portaled overlay on web, not a no-op like Alert) plus Animated for the
// slide transition, since Modal's own `animationType="slide"` only moves
// vertically, not from a side edge.
export function Drawer({ isOpen, onClose, children }: DrawerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(DRAWER_WIDTH, windowWidth);
  // Lazy useState initializer, not useRef — the React Compiler's ref rules
  // disallow reading `.current` during render, and a stable Animated.Value
  // only needs to be created once, same as a ref would give us.
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  // Modal's `visible` has no exit-animation concept — it hides instantly.
  // Keep the modal mounted through the close animation, then unmount once
  // the slide-out finishes.
  const [isMounted, setIsMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      // Intentional: synchronizes local mount state with the `isOpen` prop
      // before kicking off the enter animation — the close path can't do
      // this via plain render-time derivation since it has to wait for the
      // animation's completion callback below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMounted(true);
      Animated.timing(translateX, {
        toValue: 0,
        duration: ANIMATION_MS,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: drawerWidth,
        duration: ANIMATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsMounted(false);
      });
    }
  }, [isOpen, drawerWidth, translateX]);

  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.closeMenu')}
      />
      <Animated.View
        style={[
          styles.panel,
          {
            width: drawerWidth,
            backgroundColor: theme.background,
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.four,
    gap: Spacing.one,
  },
});
