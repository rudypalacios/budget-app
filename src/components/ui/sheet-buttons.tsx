import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, type ButtonVariant } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

export type SheetButtonsProps = {
  onCancel: () => void;
  // Defaults to common.cancel.
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  confirmVariant?: ButtonVariant;
  confirmDisabled?: boolean;
};

// The Cancel + confirm pair at the bottom of a bottom-sheet form or
// confirmation (ajustes-v2 prototype's `.fb`): side by side, wrapping to a
// stack when two long labels don't fit.
export function SheetButtons({
  onCancel,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmVariant = 'primary',
  confirmDisabled,
}: SheetButtonsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Button
        label={cancelLabel ?? t('common.cancel')}
        variant="secondary"
        onPress={onCancel}
        style={styles.button}
      />
      <Button
        label={confirmLabel}
        variant={confirmVariant}
        onPress={onConfirm}
        disabled={confirmDisabled}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
