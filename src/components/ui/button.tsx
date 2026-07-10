import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const theme = useTheme();

  const background =
    variant === 'primary' ? theme.tint : variant === 'secondary' ? theme.backgroundElement : 'transparent';
  const textColor = variant === 'primary' ? theme.tintText : variant === 'secondary' ? theme.text : theme.tint;
  const borderColor = variant === 'secondary' ? theme.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTouchTarget,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
  },
});
