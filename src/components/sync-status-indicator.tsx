import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// FR-12a: persistent sync status, visible on every screen next to the nav
// bar title. Status is a mock prop for Stage 5 — real connectivity/pending
// writes come from the Firestore listeners wired in Stage 6/7.
export type SyncStatus = 'synced' | 'pending' | 'offline';

export type SyncStatusIndicatorProps = {
  status?: SyncStatus;
  style?: StyleProp<ViewStyle>;
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  synced: 'Synced',
  pending: 'Syncing…',
  offline: 'Offline',
};

export function SyncStatusIndicator({ status = 'synced', style }: SyncStatusIndicatorProps) {
  const theme = useTheme();
  const dotColor =
    status === 'synced' ? theme.success : status === 'pending' ? theme.warning : theme.textSecondary;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Sync status: ${STATUS_LABEL[status]}`}
      style={[styles.row, style]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <ThemedText type="caption">{STATUS_LABEL[status]}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
