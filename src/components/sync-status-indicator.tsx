import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';

// FR-12a: persistent sync status, visible on every screen next to the nav
// bar title. Reflects real Firestore listener state (see useSyncStatus) by
// default; callers may still pass `status` explicitly to override it.
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

export function SyncStatusIndicator({ status, style }: SyncStatusIndicatorProps) {
  const liveStatus = useSyncStatus();
  const resolvedStatus = status ?? liveStatus;
  const theme = useTheme();
  const dotColor =
    resolvedStatus === 'synced'
      ? theme.success
      : resolvedStatus === 'pending'
        ? theme.warning
        : theme.textSecondary;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Sync status: ${STATUS_LABEL[resolvedStatus]}`}
      style={[styles.row, style]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <ThemedText type="caption">{STATUS_LABEL[resolvedStatus]}</ThemedText>
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
