import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

export type GroupNameDialogProps = {
  isOpen: boolean;
  title: string;
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

// Shared "type a name, Save/Cancel" shell for a recurringGroups/{id}
// document — used by the Dashboard's drag-to-create-group flow and by the
// recurring-groups admin screen's rename dialog (src/app/recurring-groups/
// index.tsx), the same shape as both, extracted once it hit its 2nd/3rd
// occurrence per this project's DRY convention. `initialName` is re-read
// into local state via `key` on the caller's side (same convention
// ConfirmAmountModal already uses) — this component doesn't try to
// resync mid-session if the prop changes under it.
export function GroupNameDialog({ isOpen, title, initialName, onConfirm, onCancel }: GroupNameDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title}>
      <TextField
        label={t('recurringGroups.newGroupName')}
        value={name}
        onChangeText={setName}
        placeholder={t('recurringGroups.newGroupNamePlaceholder')}
      />
      <View style={styles.actionRow}>
        <Button
          label={t('common.save')}
          onPress={() => onConfirm(name)}
          disabled={!name.trim()}
          style={styles.actionButton}
        />
        <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} style={styles.actionButton} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
