import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { MinTouchTarget, Spacing } from '@/constants/theme';

export type SettingsRowProps = {
  title: string;
  // Secondary line under the title (e.g. "3 categories").
  caption?: string;
  // Current value, shown right-aligned before the chevron (e.g. "Q (GTQ)").
  value?: string;
  onPress: () => void;
};

// The Settings screen's one tappable-row look: title (+ caption) on the
// left, optional current value and a chevron on the right. Used both for
// rows that navigate to a sub-screen (Categories, Currencies, …) and rows
// that open a picker sheet (default currency, language, trash retention).
export function SettingsRow({ title, caption, value, onPress }: SettingsRowProps) {
  const accessibilityLabel = [title, value, caption].filter(Boolean).join(', ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Card style={styles.row}>
        <View style={styles.text}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {caption !== undefined && <ThemedText type="caption">{caption}</ThemedText>}
        </View>
        {value !== undefined && (
          <ThemedText type="small" themeColor="textSecondary">
            {value}
          </ThemedText>
        )}
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTouchTarget,
  },
  text: {
    flex: 1,
  },
});
