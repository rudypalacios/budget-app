/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserSettingsStore } from '@/store/user-settings';

// Settings' theme picker (Stage 10) used to write UserSettings.theme with no
// consumer anywhere — 'light'/'dark' saved successfully but had zero visible
// effect, since every screen derived its colors purely from the OS scheme
// (see the now-resolved "theme ... stays functionally inert" Known Issue in
// CLAUDE.md). This is the one place both consumers of "what scheme is the
// app in" — this hook and _layout.tsx's expo-router ThemeProvider — now
// resolve from, so a saved override actually applies everywhere at once.
export function useResolvedColorScheme(): 'light' | 'dark' {
  const systemScheme = useColorScheme();
  const themePreference = useUserSettingsStore((state) => state.data?.theme ?? 'system');

  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }
  return systemScheme === 'unspecified' || systemScheme == null ? 'light' : systemScheme;
}

export function useTheme() {
  const theme = useResolvedColorScheme();
  return Colors[theme];
}
