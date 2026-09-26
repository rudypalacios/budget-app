import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type ActionSheetItemProps = {
  icon: SymbolViewProps['name'];
  label: string;
  // Secondary line: what the action does, or why it's unavailable.
  description?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
};

// One action row inside an ActionSheet menu (ajustes-v2 prototype's `.act`):
// icon, label and a one-line description. A disabled item stays visible with
// its description explaining why (e.g. "3 records still use this category"),
// instead of the action only failing after it's tapped.
export function ActionSheetItem({
  icon,
  label,
  description,
  onPress,
  tone = 'default',
  disabled = false,
}: ActionSheetItemProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
        disabled && styles.disabled,
      ]}
    >
      <SymbolView name={icon} size={22} tintColor={color ?? theme.textSecondary} />
      <View style={styles.text}>
        <ThemedText type="smallBold" style={color ? { color } : undefined}>
          {label}
        </ThemedText>
        {description !== undefined && <ThemedText type="caption">{description}</ThemedText>}
      </View>
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
  text: {
    flex: 1,
  },
  disabled: {
    opacity: 0.55,
  },
});
