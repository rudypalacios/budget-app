import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type CardProps = ViewProps;

export function Card({ style, ...rest }: CardProps) {
  return <ThemedView type="backgroundElement" style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
