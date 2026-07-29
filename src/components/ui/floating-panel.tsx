import { type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloatingPanelProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  anchor: AnchorRect | null;
  align?: 'left' | 'right';
}>;

// A positioned overlay anchored to a trigger's measured on-screen position —
// shared by Select (options list) and OverflowMenu (kebab menu). Built on
// React Native's own Modal, portaled on web via react-native-web (a real DOM
// portal with focus trapping, unlike Alert which is a no-op there) and a
// true native overlay on iOS/Android — so it floats above content without
// reflowing it, unlike an inline-expand list or a full route navigation.
export function FloatingPanel({ isOpen, onClose, anchor, align = 'left', children }: FloatingPanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!anchor) return null;

  const windowWidth = Dimensions.get('window').width;
  const horizontalStyle =
    align === 'left' ? { left: anchor.x } : { right: windowWidth - (anchor.x + anchor.width) };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.closeMenu')}
      />
      <View
        style={[
          styles.panelShadow,
          horizontalStyle,
          {
            top: anchor.y + anchor.height + Spacing.one,
            minWidth: anchor.width,
          },
        ]}
      >
        <View style={[styles.panelInner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dim the page behind the panel so it's unambiguous that this is an
  // overlay sitting on top of content, not content that reflowed — shadows
  // alone read weakly against a near-black dark background.
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  // Shadow lives on this outer, non-clipping wrapper — put on the same view
  // as `overflow: hidden` (needed below to clip the rounded corners) and the
  // shadow gets clipped away too, undoing the "this is floating above the
  // page" cue the shadow exists to give in the first place.
  panelShadow: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  panelInner: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
});
