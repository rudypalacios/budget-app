import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// The prototype's small secondary-colored heading above each Settings card —
// quieter than SectionHeader, since here the cards themselves carry the
// structure.
export function SettingsSectionTitle({ title }: { title: string }) {
  return (
    <ThemedText
      type="caption"
      themeColor="textSecondary"
      accessibilityRole="header"
      style={styles.title}
    >
      {title}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  title: {
    fontWeight: 500,
    marginHorizontal: 2,
  },
});
