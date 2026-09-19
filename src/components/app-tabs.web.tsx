import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs, TabList, TabTrigger, TabSlot, TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View, StyleSheet } from 'react-native';

import { SyncStatusIndicator } from './sync-status-indicator';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing, WebBottomNavHeight } from '@/constants/theme';
import { useIsCompactWebNav } from '@/hooks/use-nav-layout';
import { useTheme } from '@/hooks/use-theme';

// Kept in sync by hand with app-tabs.tsx's NativeTabs.Trigger list (native
// iOS/Android) — see the comment there. A new tab needs an entry here too.
// labelKey is a nav.* translation key, resolved at render time (below) since
// this array lives outside the component, where the t() hook isn't available.
// icon.web reuses the same Material Symbols name as icon.android (md) — the
// same convention already used by IconButton callers elsewhere in this file
// (e.g. the back button's { android: 'arrow_back', web: 'arrow_back' }).
const TAB_ITEMS = [
  {
    name: 'index',
    href: '/',
    labelKey: 'nav.payments',
    icon: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    name: 'expenses',
    href: '/expenses',
    labelKey: 'nav.expenses',
    icon: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  },
  {
    name: 'income',
    href: '/income',
    labelKey: 'nav.income',
    icon: { ios: 'dollarsign.circle', android: 'attach_money', web: 'attach_money' },
  },
  {
    name: 'budget',
    href: '/budget',
    labelKey: 'nav.budget',
    icon: { ios: 'chart.pie', android: 'pie_chart', web: 'pie_chart' },
  },
  {
    name: 'history',
    href: '/history',
    labelKey: 'nav.history',
    icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  },
  {
    name: 'settings',
    href: '/settings',
    labelKey: 'nav.settings',
    icon: { ios: 'gearshape', android: 'settings', web: 'settings' },
  },
] as const satisfies readonly {
  name: string;
  href: string;
  labelKey: string;
  icon: SymbolViewProps['name'];
}[];

export default function AppTabs() {
  const { t } = useTranslation();
  const isCompact = useIsCompactWebNav();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      {isCompact ? (
        <TabList asChild>
          <WebBottomTabBar>
            {TAB_ITEMS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                <WebBottomTabButton icon={tab.icon}>{t(tab.labelKey)}</WebBottomTabButton>
              </TabTrigger>
            ))}
          </WebBottomTabBar>
        </TabList>
      ) : (
        <TabList asChild>
          <CustomTabList>
            {TAB_ITEMS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                <TabButton>{t(tab.labelKey)}</TabButton>
              </TabTrigger>
            ))}
          </CustomTabList>
        </TabList>
      )}
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

export function CustomTabList(props: TabListProps) {
  const { t } = useTranslation();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          {t('common.appName')}
        </ThemedText>

        <SyncStatusIndicator style={styles.syncStatus} />

        {props.children}
      </ThemedView>
    </View>
  );
}

// The compact-viewport replacement for the old hamburger + slide-in drawer —
// a fixed bottom bar with one icon+label button per tab, mirroring
// app-tabs.tsx's native NativeTabs bar as closely as a web nav can (see that
// file's comment: NativeTabs renders the real OS tab bar controller, which
// has no web equivalent to literally reuse).
function WebBottomTabBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[styles.bottomBarContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}
    >
      <View style={styles.bottomBarInner}>{props.children}</View>
    </View>
  );
}

function WebBottomTabButton({
  icon,
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: SymbolViewProps['name'] }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => [styles.bottomTabButton, pressed && styles.pressed]}>
      <View style={[styles.bottomTabIcon, isFocused && { backgroundColor: theme.backgroundSelected }]}>
        <SymbolView name={icon} size={22} tintColor={isFocused ? theme.text : theme.textSecondary} />
      </View>
      <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'} style={styles.bottomTabLabel}>
        {children}
      </ThemedText>
    </Pressable>
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
  bottomBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WebBottomNavHeight,
    borderTopWidth: 1,
  },
  bottomBarInner: {
    flex: 1,
    flexDirection: 'row',
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  bottomTabIcon: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
  },
  bottomTabLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
});
