import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormRowBreakpoint, Spacing } from '@/constants/theme';
import type { LifecycleRecord } from '@/lib/lifecycle-records';

export type ConfirmRecordsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // Intro sentence above the numbered list — caller resolves any
  // singular/plural wording via t() before passing it in, since the right
  // phrasing differs per action (restore vs. permanently delete).
  message: string;
  records: LifecycleRecord[];
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void | Promise<void>;
};

// Shared confirm shell for any Archive/Trash action that affects a list of
// records (one row or a bulk selection, same component either way) — used
// by Trash's restore and permanent-delete confirmations and Archive's
// restore confirmation. Explicitly listing every affected record (not just
// "3 items") is the point: found live that a bare Restore/Delete button
// with no confirmation was too easy to trigger by mistake, especially once
// bulk selection made one click affect several records at once.
export function ConfirmRecordsDialog({
  isOpen,
  onClose,
  title,
  message,
  records,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
}: ConfirmRecordsDialogProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < FormRowBreakpoint;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <ThemedText>{message}</ThemedText>
      <View style={styles.list}>
        {records.map((record, index) => (
          <ThemedText key={`${record.recordType}-${record.id}`} type="caption">
            {index + 1}. {record.name}
          </ThemedText>
        ))}
      </View>
      <View style={[styles.actions, isNarrow && styles.actionsNarrow]}>
        <Button
          label={confirmLabel}
          variant={confirmVariant}
          onPress={onConfirm}
          style={isNarrow ? styles.buttonNarrow : styles.button}
        />
        <Button
          label={t('common.cancel')}
          variant="secondary"
          onPress={onClose}
          style={isNarrow ? styles.buttonNarrow : styles.button}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // Below FormRowBreakpoint, two long labels ("Delete permanently") no
  // longer fit two-up without wrapping — stack full-width instead, same
  // breakpoint/pattern as AmountCurrencyField.
  actionsNarrow: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
  },
  buttonNarrow: {
    width: '100%',
  },
});
