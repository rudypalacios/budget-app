import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { MinTouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  name: SymbolViewProps['name'];
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 18,
  disabled,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <SymbolView name={name} size={size} tintColor={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: MinTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
});
