import { Children, isValidElement, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';

// One grouped card of Settings rows, separated by hairlines (ajustes-v2
// prototype's `.set` + `.srow` border-top). Rows own their own padding, so
// the card itself has none; overflow is clipped so a row's pressed
// background follows the card's rounded corners.
export function SettingsCard({ children }: PropsWithChildren) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <Card style={styles.card}>
      {rows.map((row, index) => (
        <View
          key={row.key ?? index}
          style={
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            }
          }
        >
          {row}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
});
