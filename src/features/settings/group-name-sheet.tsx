import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/ui/action-sheet';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { TextField } from '@/components/ui/text-field';

export type GroupNameSheetProps = {
  title: string;
  initialName: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
};

// "Type a name, Save/Cancel" for creating or renaming a recurring group — a
// bottom sheet per the ajustes-v2 prototype (it used to be an inline card
// for create and a centered dialog for rename). Mounted only while open, so
// the name starts from `initialName` each time.
export function GroupNameSheet({
  title,
  initialName,
  confirmLabel,
  onConfirm,
  onClose,
}: GroupNameSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  return (
    <ActionSheet isOpen onClose={onClose} title={title}>
      <TextField
        label={t('recurringGroups.newGroupName')}
        value={name}
        onChangeText={setName}
        placeholder={t('recurringGroups.newGroupNamePlaceholder')}
        autoFocus
      />
      <SheetButtons
        onCancel={onClose}
        confirmLabel={confirmLabel}
        onConfirm={() => onConfirm(name)}
        confirmDisabled={!name.trim()}
      />
    </ActionSheet>
  );
}
