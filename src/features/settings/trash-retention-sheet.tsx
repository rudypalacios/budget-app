import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionSheet } from '@/components/ui/action-sheet';

import { OptionRow } from './option-row';

// Fixed choices, never free text (RN-AJU-3): with write-on-change, a text
// field would persist every half-typed value.
export const TRASH_RETENTION_OPTIONS = [7, 14, 30, 60, 90] as const;

export type TrashRetentionSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  currentDays: number;
  onSelect: (days: number) => void;
};

export function TrashRetentionSheet({
  isOpen,
  onClose,
  currentDays,
  onSelect,
}: TrashRetentionSheetProps) {
  const { t } = useTranslation();

  return (
    <ActionSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.trashRetentionSheetTitle')}
    >
      <View>
        {TRASH_RETENTION_OPTIONS.map((days) => (
          <OptionRow
            key={days}
            label={t('settings.data.trashRetentionOption', { count: days })}
            isSelected={days === currentDays}
            indicator="radio"
            onPress={() => {
              if (days !== currentDays) onSelect(days);
              onClose();
            }}
          />
        ))}
      </View>
    </ActionSheet>
  );
}
