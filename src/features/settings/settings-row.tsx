import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CHEVRON: SymbolViewProps['name'] = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
};

export type SettingsRowProps = {
  title: string;
  // Secondary line under the title.
  subtitle?: ReactNode;
  // Leading icon, drawn in the prototype's accent circle (`.cic`).
  icon?: SymbolViewProps['name'];
  // Right-aligned current value (e.g. "Q (GTQ)", "3 categories").
  value?: string;
  // Extra element after the value (e.g. a "2 need refresh" chip).
  badge?: ReactNode;
  // Trailing icon in place of the chevron (e.g. sign out's logout icon).
  trailingIcon?: SymbolViewProps['name'];
  // Omit for a static row (no chevron, not pressable).
  onPress?: () => void;
  // Screen-reader text when it should differ from title + value.
  accessibilityLabel?: string;
};

// One row inside a SettingsCard (ajustes-v2 prototype's `.srow`): used for
// sub-screen navigation, for rows that open a picker sheet, and for static
// info rows like the signed-in account.
export function SettingsRow({
  title,
  subtitle,
  icon,
  value,
  badge,
  trailingIcon,
  onPress,
  accessibilityLabel,
}: SettingsRowProps) {
  const theme = useTheme();

  const content = (
    <>
      {icon !== undefined && (
        <View style={[styles.iconCircle, { backgroundColor: theme.tintSurface }]}>
          <SymbolView name={icon} size={18} tintColor={theme.tint} />
        </View>
      )}
      <View style={styles.text}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {typeof subtitle === 'string' ? (
          <ThemedText type="caption">{subtitle}</ThemedText>
        ) : (
          subtitle
        )}
      </View>
      {(value !== undefined || badge !== undefined) && (
        <View style={styles.trailing}>
          {value !== undefined && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
              {value}
            </ThemedText>
          )}
          {badge}
        </View>
      )}
      {onPress && (
        <SymbolView
          name={trailingIcon ?? CHEVRON}
          size={trailingIcon ? 18 : 16}
          tintColor={theme.textSecondary}
        />
      )}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, value].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The title keeps a floor width so a long value + badge wraps onto a
  // second line instead of breaking the title mid-word.
  text: {
    flex: 1,
    minWidth: 100,
  },
  // Value and badge share a line, as in the prototype; under 150% font
  // scale they wrap instead of pushing the title off-screen.
  trailing: {
    flexShrink: 1,
    maxWidth: '60%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one + 2,
  },
  value: {
    textAlign: 'right',
  },
});
