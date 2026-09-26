import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { type ButtonVariant } from '@/components/ui/button';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { Spacing } from '@/constants/theme';
import type { LifecycleRecord } from '@/lib/lifecycle-records';

export type ConfirmRecordsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // Intro sentence above the list — caller resolves any singular/plural
  // wording via t() before passing it in, since the right phrasing differs
  // per action (restore vs. permanently delete).
  message: string;
  records: LifecycleRecord[];
  // Optional closing line under the list (e.g. "This can't be undone.").
  footnote?: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void | Promise<void>;
};

// Shared confirm step for any Archive/Trash action that affects a list of
// records (one row or a bulk selection, same component either way).
// Explicitly listing every affected record (not just "3 items") is the
// point: found live that a bare Restore/Delete button with no confirmation
// was too easy to trigger by mistake, especially once bulk selection made
// one click affect several records at once. A bottom sheet since the
// Ajustes redesign (ajustes-v2 prototype); it used to be a centered Dialog.
export function ConfirmRecordsSheet({
  isOpen,
  onClose,
  title,
  message,
  records,
  footnote,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
}: ConfirmRecordsSheetProps) {
  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title={title}>
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
      <View style={styles.list}>
        {records.map((record) => (
          <ThemedText key={`${record.recordType}-${record.id}`} type="small">
            {`• ${record.name}`}
          </ThemedText>
        ))}
      </View>
      {footnote !== undefined && (
        <ThemedText type="small" themeColor="textSecondary">
          {footnote}
        </ThemedText>
      )}
      <SheetButtons
        onCancel={onClose}
        confirmLabel={confirmLabel}
        confirmVariant={confirmVariant}
        onConfirm={onConfirm}
      />
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.half,
  },
});
