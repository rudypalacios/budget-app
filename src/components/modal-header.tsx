import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';

// Cancel lives at the bottom of the form now, alongside Save — see
// expense-form.tsx / income-form.tsx / category-form.tsx. This header is
// just the title; dismissal is swipe-down on native or the bottom Cancel
// button (browser back also works on web). onBack is an exception for
// screens with no bottom Cancel button (e.g. login.tsx), which need an
// explicit way back in addition to swipe/programmatic dismissal.
export type ModalHeaderProps = {
  title: string;
  onBack?: () => void;
};

export function ModalHeader({ title, onBack }: ModalHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {onBack && (
        <IconButton
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          size={18}
        />
      )}
      <ThemedText type="title">{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
