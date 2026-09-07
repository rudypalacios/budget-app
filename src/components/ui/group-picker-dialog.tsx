import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type GroupPickerOption = {
  id: string;
  name: string;
};

export type GroupPickerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  options: GroupPickerOption[];
  onSelect: (id: string) => void;
};

// Stage 18 (FR-21) — the "Add to group..." picker: every other active,
// ungrouped expense is a valid choice (see eligibleGroupParents). A plain
// pressable list, same shell as ConfirmRecordsDialog, rather than trying to
// repurpose the form-row Select — this is launched from an OverflowMenu
// action, not embedded in a form.
export function GroupPickerDialog({ isOpen, onClose, options, onSelect }: GroupPickerDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('grouping.pickerTitle')}>
      {options.length === 0 ? (
        <ThemedText type="caption">{t('grouping.pickerEmpty')}</ThemedText>
      ) : (
        <View style={styles.list}>
          {options.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                onSelect(option.id);
                onClose();
              }}
              onHoverIn={() => setHoveredId(option.id)}
              onHoverOut={() => setHoveredId(null)}
              accessibilityRole="button"
              style={[
                styles.option,
                {
                  backgroundColor: hoveredId === option.id ? theme.backgroundSelected : 'transparent',
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText>{option.name}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.one,
  },
  option: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.one,
  },
});
