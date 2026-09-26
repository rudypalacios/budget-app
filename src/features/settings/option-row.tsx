import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type OptionRowProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  // 'check' = the prototype's leading ✓ list (currency, language);
  // 'radio' = its radio list (trash retention).
  indicator?: 'check' | 'radio';
};

// One choice in a Settings picker sheet. Selection is exposed through
// accessibilityState.selected as well, so it never relies on the glyph alone.
export function OptionRow({ label, isSelected, onPress, indicator = 'check' }: OptionRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}
    >
      {indicator === 'check' ? (
        // Kept in the layout when unselected (just invisible) so every label
        // lines up, as in the prototype.
        <View style={[styles.indicator, !isSelected && styles.hidden]}>
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={20}
            tintColor={theme.textSecondary}
          />
        </View>
      ) : (
        <View
          style={[styles.radio, { borderColor: isSelected ? theme.tint : theme.textSecondary }]}
        >
          {isSelected && <View style={[styles.radioDot, { backgroundColor: theme.tint }]} />}
        </View>
      )}
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  indicator: {
    width: 22,
    alignItems: 'center',
  },
  hidden: {
    opacity: 0,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    flex: 1,
  },
});
