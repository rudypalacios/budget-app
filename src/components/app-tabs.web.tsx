import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { Drawer } from './ui/drawer';
import { IconButton } from './ui/icon-button';
import { SyncStatusIndicator } from './sync-status-indicator';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, NavBreakpoint, Spacing } from '@/constants/theme';

// Kept in sync by hand with app-tabs.tsx's NativeTabs.Trigger list (native
// iOS/Android) — see the comment there. A new tab needs an entry here too.
// labelKey is a nav.* translation key, resolved at render time (below) since
// this array lives outside the component, where the t() hook isn't available.
const TAB_ITEMS = [
  { name: 'index', href: '/', labelKey: 'nav.payments' },
  { name: 'expenses', href: '/expenses', labelKey: 'nav.expenses' },
  { name: 'income', href: '/income', labelKey: 'nav.income' },
  { name: 'budget', href: '/budget', labelKey: 'nav.budget' },
  { name: 'history', href: '/history', labelKey: 'nav.history' },
  { name: 'settings', href: '/settings', labelKey: 'nav.settings' },
] as const;

export default function AppTabs() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isCompact = width < NavBreakpoint;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList isCompact={isCompact} onMenuPress={() => setIsDrawerOpen(true)}>
          {TAB_ITEMS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{t(tab.labelKey)}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>

      {/* Same tab destinations, rendered a second time for the drawer — see
          app-tabs.web.tsx's CustomTabList for the pill version. expo-router/ui's
          TabTrigger is a plain "link to this tab" primitive, not tied to a
          single TabList, so the same `name` can be triggered from more than
          one place in the tree and still resolve/highlight consistently. */}
      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer}>
        <View style={styles.drawerHeader}>
          <ThemedText type="smallBold">{t('common.appName')}</ThemedText>
          <IconButton
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            accessibilityLabel={t('common.closeMenu')}
            onPress={closeDrawer}
            size={16}
          />
        </View>
        {TAB_ITEMS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <DrawerLink onNavigate={closeDrawer}>{t(tab.labelKey)}</DrawerLink>
          </TabTrigger>
        ))}
      </Drawer>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}
      >
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function DrawerLink({
  children,
  isFocused,
  onPress,
  onNavigate,
  ...props
}: TabTriggerSlotProps & { onNavigate: () => void }) {
  return (
    <Pressable
      {...props}
      onPress={(event) => {
        onPress?.(event);
        onNavigate();
      }}
      style={({ pressed }) => [styles.drawerLink, pressed && styles.pressed]}
    >
      <ThemedText type="default" themeColor={isFocused ? 'tint' : 'text'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function CustomTabList({
  isCompact,
  onMenuPress,
  ...props
}: TabListProps & { isCompact: boolean; onMenuPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          {t('common.appName')}
        </ThemedText>

        <SyncStatusIndicator style={styles.syncStatus} />

        {isCompact ? (
          <IconButton
            name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
            accessibilityLabel={t('common.openMenu')}
            onPress={onMenuPress}
            size={18}
          />
        ) : (
          props.children
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  syncStatus: {
    marginRight: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  drawerLink: {
    paddingVertical: Spacing.three,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
});
