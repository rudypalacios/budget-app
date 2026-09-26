import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { SheetButtons } from '@/components/ui/sheet-buttons';

export type DiscardChangesSheetProps = {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

// "Discard changes?" before leaving a form with unsaved edits. Built on
// ActionSheet rather than Alert.alert(), which react-native-web implements
// as a no-op — see CLAUDE.md Known Issues ("No discard changes? confirmation
// on form Cancel").
export function DiscardChangesSheet({
  isOpen,
  onKeepEditing,
  onDiscard,
}: DiscardChangesSheetProps) {
  const { t } = useTranslation();

  return (
    <ActionSheet isOpen={isOpen} onClose={onKeepEditing} title={t('common.discardTitle')}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('common.discardMessage')}
      </ThemedText>
      <SheetButtons
        onCancel={onKeepEditing}
        cancelLabel={t('common.keepEditing')}
        confirmLabel={t('common.discard')}
        confirmVariant="danger"
        onConfirm={onDiscard}
      />
    </ActionSheet>
  );
}
