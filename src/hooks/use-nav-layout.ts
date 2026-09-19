import { Platform, useWindowDimensions } from 'react-native';

import { NavBreakpoint } from '@/constants/theme';

// Shared by app-tabs.web.tsx (which decides its own compact-vs-wide render)
// and by screen-scroll.tsx/ui/toast.tsx (which need to know whether the
// compact WebBottomTabBar or the wide floating pill is currently on screen,
// to reserve the right amount of space). Always false on native — nativeTabs'
// own tab bar/insets are unaffected by this.
export function useIsCompactWebNav() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width < NavBreakpoint;
}
