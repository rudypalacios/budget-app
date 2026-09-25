import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = ViewProps;

// Redesign (v9 prototype): hairline border, 12px radius and 12/14 padding —
// tighter than the original 16/16 so lists of cards read denser. Callers can
// still override borderColor/borderWidth (e.g. the danger outline on an
// over-budget category).
export function Card({ style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
