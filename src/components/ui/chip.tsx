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
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, tone = 'neutral', size = 'default', style }: ChipProps) {
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
        {
          // Semantic tones use a translucent wash of the tone color as the
          // fill (see Stage 4 design preview) rather than a new set of pale
          // "container" tokens — one token per tone stays enough here.
          backgroundColor: toneColor ? `${toneColor}22` : theme.backgroundSelected,
          borderColor: toneColor ? 'transparent' : theme.border,
        },
        style,
      ]}
    >
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
  small: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  smallText: {
    fontWeight: '600',
  },
});
