import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SyncStatusIndicator, type SyncStatus } from '@/components/sync-status-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';

// FR-12a: the sync indicator needs to be visible "next to the title" on
// every screen. The native NativeTabs bottom tab bar has no slot for
// arbitrary content (its one accessory API is iOS 26+ only), so each
// screen renders this header itself rather than relying on shared nav
// chrome — the indicator still ends up next to every screen's title, just
// per-screen instead of injected into the tab bar shell.
export type ScreenHeaderProps = {
  title: string;
  // Small secondary line under the title (e.g. the Budget tab's "September
  // 2026"). Optional — most screens don't have one.
  subtitle?: string;
  syncStatus?: SyncStatus;
  // Set on screens reached by pushing (not a tab root) — headerShown is
  // false globally (src/app/_layout.tsx), so pushed screens need their own
  // way back since there's no native header chrome to supply one.
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({ title, subtitle, syncStatus, onBack, style }: ScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleRow}>
        {onBack && (
          <IconButton
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            accessibilityLabel={t('common.back')}
            onPress={onBack}
            size={18}
          />
        )}
        <View style={styles.titleText}>
          <ThemedText type="title">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <SyncStatusIndicator status={syncStatus} />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  titleText: {
    flexShrink: 1,
  },
});
