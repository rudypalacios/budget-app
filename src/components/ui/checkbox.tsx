import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CheckboxProps = {
  checked: boolean;
  onValueChange: (checked: boolean) => void;
  accessibilityLabel: string;
};

// Distinct from Switch (on/off state that takes effect immediately, e.g.
// paid/archived) — this is a selection control for the Archive/Trash
// screens' bulk-action checkboxes (Stage 17 feedback round), which only
// stages rows for a separate explicit bulk action.
export function Checkbox({ checked, onValueChange, accessibilityLabel }: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onValueChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={styles.hitArea}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? theme.tint : theme.border,
            backgroundColor: checked ? theme.tint : 'transparent',
          },
        ]}
      >
        {checked && (
          <ThemedText type="smallBold" themeColor="tintText" style={styles.mark}>
            ✓
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 13,
    lineHeight: 15,
  },
});
