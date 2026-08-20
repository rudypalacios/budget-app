import { type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DialogProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>;

// A centered confirm-style overlay — same Modal/backdrop-Pressable
// technique as FloatingPanel (a real react-native-web DOM portal, unlike
// Alert.alert()'s no-op there), but centered rather than anchored to a
// trigger's position. Deliberately just a shell (title + children, no
// baked-in action-button API) so each concrete dialog composes its own
// body/buttons — this is the "real custom confirm-dialog component" the
// deferred discard-changes-on-Cancel Known Issue was waiting on; keeping it
// generic here means that future work can build on this instead of needing
// its own primitive.
export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.closeDialog')}
      />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <ThemedText type="smallBold">{title}</ThemedText>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    // Was MaxContentWidth / 2 (400) — too narrow for a two-button action row
    // where one label is "Delete permanently"; that wrapped to two lines at
    // the old width even before accounting for the callers that also stack
    // to full-width buttons below FormRowBreakpoint (see e.g. trash/index.tsx).
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
