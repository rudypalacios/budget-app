import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

export type ChipProps = {
  label: string;
  tone?: ChipTone;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, tone = 'neutral', style }: ChipProps) {
  const theme = useTheme();
  const toneColor = tone === 'neutral' ? null : theme[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.chip,
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
      <ThemedText type="smallBold" themeColor={tone === 'neutral' ? 'text' : tone}>
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
});
