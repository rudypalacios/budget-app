import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ProgressBarProps = {
  budgeted: number;
  actual: number;
  style?: StyleProp<ViewStyle>;
};

// FR-6 visual alert thresholds: comfortably under budget stays neutral,
// approaching the limit warns, crossing it alerts.
const WARNING_RATIO = 0.8;

export function ProgressBar({ budgeted, actual, style }: ProgressBarProps) {
  const theme = useTheme();
  const ratio = budgeted > 0 ? actual / budgeted : 0;
  const fillPercent = `${Math.min(ratio, 1) * 100}%` as const;
  const fillColor = ratio > 1 ? theme.danger : ratio >= WARNING_RATIO ? theme.warning : theme.success;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: budgeted, now: Math.min(actual, budgeted) }}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }, style]}
    >
      <View style={[styles.fill, { width: fillPercent, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: Spacing.two,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Spacing.one,
  },
});
