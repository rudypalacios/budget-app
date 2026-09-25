import { type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ActionSheetProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>;

// Content never grows past this share of the window, so the scrim above the
// sheet always stays visible (and tappable to close) even with long content.
const MAX_HEIGHT_RATIO = 0.88;

// A bottom-anchored sheet — same Modal + backdrop-Pressable technique as
// Dialog, but anchored to the bottom edge instead of centered. Deliberately
// just a shell (title + free-form children): menus/forms compose their own
// content, and a menu-row primitive (ActionSheetItem) is left for when the
// Dashboard menus actually need it (Presupuesto redesign, fase 2).
//
// Web closing/a11y comes from react-native-web's own Modal: Escape calls
// onRequestClose, the content gets role="dialog" + aria-modal, focus is
// trapped inside and returned to the trigger on close — so none of that is
// reimplemented here. Native back button also routes through onRequestClose.
export function ActionSheet({ isOpen, onClose, title, children }: ActionSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label={title}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.closeDialog')}
      />
      {/* iOS needs padding to lift the sheet above the keyboard; Android's
          "height" shrinks the container instead. Web has no software-keyboard
          overlap to handle, so the component is a no-op there. */}
      <KeyboardAvoidingView
        style={styles.bottomWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              maxHeight: windowHeight * MAX_HEIGHT_RATIO,
              paddingBottom: Spacing.three + insets.bottom,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
              {title}
            </ThemedText>
            <IconButton
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              onPress={onClose}
              accessibilityLabel={t('common.closeDialog')}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bottomWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    borderTopWidth: 1,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  // The horizontal padding lives here, inside the ScrollView, rather than
  // on the panel: a ScrollView clips its children, so with the padding
  // outside it a full-width TextField's browser focus outline (drawn just
  // outside its border) got cut off at the edges. paddingVertical gives the
  // outline the same room at the top/bottom of the scrollable area.
  content: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    gap: Spacing.three,
  },
});
