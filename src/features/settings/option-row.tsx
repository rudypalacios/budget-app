import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';

export type OptionRowProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

// One choice in a Settings picker sheet (currency, language, trash
// retention): the current value gets a ✓ and, for screen readers,
// accessibilityState.selected — so selection never relies on the glyph alone.
export function OptionRow({ label, isSelected, onPress }: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ThemedText type={isSelected ? 'smallBold' : 'small'} style={styles.label}>
        {label}
      </ThemedText>
      {isSelected && <ThemedText themeColor="tint">✓</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTouchTarget,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
