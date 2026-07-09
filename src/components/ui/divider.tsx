import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

export function Divider({ style }: DividerProps) {
  const theme = useTheme();

  return (
    <View
      // Purely decorative — hidden from screen readers on both platforms.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.divider, { backgroundColor: theme.border }, style]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
