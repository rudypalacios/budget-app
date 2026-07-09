import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// Cancel lives at the bottom of the form now, alongside Save — see
// expense-form.tsx / income-form.tsx / category-form.tsx. This header is
// just the title; dismissal is swipe-down on native or the bottom Cancel
// button (browser back also works on web).
export type ModalHeaderProps = {
  title: string;
};

export function ModalHeader({ title }: ModalHeaderProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="title">{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
