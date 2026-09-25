import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/format-date';

export type DatePickerProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
};

// Android's native dialog closes itself on any interaction (pick or
// cancel), so the picker only needs to be shown/hidden around opening it.
// iOS's 'inline' calendar has no such built-in dismissal, so it stays open
// (live-updating `value`) until the user taps the explicit Done button
// below — a widely-used pattern for this library since iOS has no single
// display mode that both looks like a calendar and auto-closes.
export function DatePicker({ label, value, onChange, placeholder }: DatePickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedPlaceholder = placeholder ?? t('common.selectDatePlaceholder');

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') setIsOpen(false);
    if (event.type === 'set' && selectedDate) onChange(selectedDate);
  }

  return (
    <View>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ? formatShortDate(value) : resolvedPlaceholder }}
        style={[
          styles.field,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
      >
        <ThemedText themeColor={value ? 'text' : 'textSecondary'}>
          {value ? formatShortDate(value) : resolvedPlaceholder}
        </ThemedText>
      </Pressable>

      {isOpen && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' && (
            <Button label={t('common.done')} variant="secondary" onPress={() => setIsOpen(false)} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  pickerWrap: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
