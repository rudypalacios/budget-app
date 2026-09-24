import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BudgetStatus } from '@/lib/budget-status';

export type ProgressBarStatus = Exclude<BudgetStatus, 'none'>;

export type ProgressBarProps = {
  status: ProgressBarStatus;
  budgeted: number;
  actual: number;
  style?: StyleProp<ViewStyle>;
};

// Presupuesto redesign §5.3. The old "near the limit (>= 80%)" warning is
// gone on purpose: real risk is now 'mayExceed' (pending bills would push
// the category over), which budget-status.ts decides — not a fixed ratio.
const STATUS_COLOR: Record<ProgressBarStatus, ThemeColor> = {
  over: 'danger',
  mayExceed: 'warning',
  exact: 'success',
  ok: 'tint',
};

export function ProgressBar({ status, budgeted, actual, style }: ProgressBarProps) {
  const theme = useTheme();
  const ratio = budgeted > 0 ? actual / budgeted : 0;
  const fillPercent = `${Math.min(ratio, 1) * 100}%` as const;

  // Hidden from screen readers: the only consumer (CategoryBudgetCard) folds
  // percent and status into its own accessibilityLabel, so reading the bar
  // too would announce the same thing twice.
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: budgeted, now: Math.min(actual, budgeted) }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[styles.track, { backgroundColor: theme.backgroundSelected }, style]}
    >
      <View style={[styles.fill, { width: fillPercent, backgroundColor: theme[STATUS_COLOR[status]] }]} />
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
