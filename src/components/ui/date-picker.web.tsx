import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DatePickerProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  // Not used on web — browsers render their own "mm/dd/yyyy"-style
  // placeholder for an empty <input type="date"> that can't be overridden
  // consistently across browsers. Kept in the shared prop signature so
  // callers don't need a platform branch.
  placeholder?: string;
};

function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The browser's native <input type="date"> — no calendar-picker dependency
// needed on web, unlike native (@react-native-community/datetimepicker
// doesn't support react-native-web; see date-picker.tsx).
export function DatePicker({ label, value, onChange }: DatePickerProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <input
        type="date"
        value={value ? toISODateString(value) : ''}
        onChange={(event) => {
          const raw = event.target.value; // 'YYYY-MM-DD', or '' if cleared
          if (raw) onChange(new Date(`${raw}T00:00:00`));
        }}
        style={{
          minHeight: MinTouchTarget,
          border: `1px solid ${theme.border}`,
          borderRadius: Spacing.two,
          paddingLeft: Spacing.three,
          paddingRight: Spacing.three,
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          fontSize: 16,
          fontFamily: 'inherit',
        }}
      />
    </View>
  );
}
