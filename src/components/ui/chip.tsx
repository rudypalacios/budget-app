import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

export type ChipProps = {
  label: string;
  tone?: ChipTone;
  // 'small' for dense rows (e.g. the Budget tab's movement list, v9 look).
  size?: 'default' | 'small';
  // Optional leading icon in the chip's text color, so status never relies
  // on color alone (e.g. the Budget tab's over-budget / may-exceed chips).
  icon?: SymbolViewProps['name'];
  style?: StyleProp<ViewStyle>;
};

const TONE_SURFACE = {
  success: 'successSurface',
  warning: 'warningSurface',
  danger: 'dangerSurface',
} as const;

export function Chip({ label, tone = 'neutral', size = 'default', icon, style }: ChipProps) {
  const theme = useTheme();
  const toneColor = tone === 'neutral' ? null : theme[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.chip,
        size === 'small' && styles.small,
        icon !== undefined && styles.withIcon,
        {
          // Semantic tones sit on the palette's matching tint (the v9
          // prototype's bg-* colors), which keeps the tone text readable.
          backgroundColor:
            tone === 'neutral' ? theme.backgroundSelected : theme[TONE_SURFACE[tone]],
          borderColor: toneColor ? 'transparent' : theme.border,
        },
        style,
      ]}
    >
      {icon !== undefined && (
        <SymbolView
          name={icon}
          size={size === 'small' ? 12 : 14}
          tintColor={tone === 'neutral' ? theme.text : theme[tone]}
        />
      )}
      <ThemedText
        type={size === 'small' ? 'caption' : 'smallBold'}
        themeColor={tone === 'neutral' ? 'text' : tone}
        style={size === 'small' ? styles.smallText : undefined}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  withIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  small: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  smallText: {
    fontWeight: '500',
  },
});
