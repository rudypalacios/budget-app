import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Equal-width button group with the active one filled in the accent color
// (ajustes-v2 prototype's `.seg`) — Settings' theme choice and the category
// form's type. The active
// state is also announced (accessibilityState.selected), not only colored.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!isSelected) onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.segment,
              isSelected
                ? { backgroundColor: theme.tint, borderColor: 'transparent' }
                : { borderColor: theme.border },
              pressed && !isSelected && { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText type="small" style={isSelected ? { color: theme.tintText } : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
  },
  segment: {
    flex: 1,
    minHeight: MinTouchTarget,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
