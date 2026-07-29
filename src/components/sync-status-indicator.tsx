import { useTranslation } from 'react-i18next';
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

const STATUS_LABEL_KEY: Record<SyncStatus, string> = {
  synced: 'syncStatus.synced',
  pending: 'syncStatus.syncing',
  offline: 'syncStatus.offline',
};

export function SyncStatusIndicator({ status, style }: SyncStatusIndicatorProps) {
  const { t } = useTranslation();
  const liveStatus = useSyncStatus();
  const resolvedStatus = status ?? liveStatus;
  const theme = useTheme();
  const dotColor =
    resolvedStatus === 'synced'
      ? theme.success
      : resolvedStatus === 'pending'
        ? theme.warning
        : theme.textSecondary;
  const statusLabel = t(STATUS_LABEL_KEY[resolvedStatus]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('syncStatus.label', { status: statusLabel })}
      style={[styles.row, style]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <ThemedText type="caption">{statusLabel}</ThemedText>
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
