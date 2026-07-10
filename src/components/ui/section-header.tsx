import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionLabel, onActionPress, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <ThemedText type="default" style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <ThemedText type="linkPrimary">{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontWeight: 700,
  },
});
