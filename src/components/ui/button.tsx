import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const theme = useTheme();
  const [isPending, setIsPending] = useState(false);

  // 'danger' reuses tintText for its on-color label, same as 'primary' — each
  // theme calibrates tintText's contrast against tint's lightness, and danger
  // is paired at a matching lightness in both themes (see theme.ts), so the
  // same text color reads correctly on either fill.
  const background =
    variant === 'primary'
      ? theme.tint
      : variant === 'secondary'
        ? theme.backgroundElement
        : variant === 'danger'
          ? theme.danger
          : 'transparent';
  const textColor =
    variant === 'primary' || variant === 'danger' ? theme.tintText : variant === 'secondary' ? theme.text : theme.tint;
  const borderColor = variant === 'secondary' ? theme.border : 'transparent';
  const isDisabled = disabled || isPending;

  async function handlePress() {
    if (isPending) return;
    // Tied to onPress (not onBlur), so this only fires on an explicit tap of
    // the button itself, never when focus simply moves between fields.
    Keyboard.dismiss();
    const result = onPress();
    if (result instanceof Promise) {
      setIsPending(true);
      try {
        await result;
      } finally {
        setIsPending(false);
      }
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isPending }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <ThemedText type="smallBold" style={{ color: textColor }}>
          {label}
        </ThemedText>
      )}
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
