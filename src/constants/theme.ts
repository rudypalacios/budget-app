/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#14181F',
    background: '#FAFBFD',
    backgroundElement: '#F1F3F7',
    backgroundSelected: '#E4E8F0',
    textSecondary: '#4B5563',
    // Below are Stage 4 additions — see docs/SRS-presupuesto-app.md NFR-3.
    // All hex values are WCAG AA verified (>=4.5:1) both as text on
    // `background`/`backgroundElement` and as a solid fill under `tintText`.
    border: '#E1E5EC',
    tint: '#2F63CB',
    tintText: '#FFFFFF',
    success: '#167A54',
    warning: '#805100',
    danger: '#B3261E',
  },
  dark: {
    text: '#EEF1F5',
    background: '#0A0C10',
    backgroundElement: '#14171D',
    backgroundSelected: '#1D2129',
    textSecondary: '#99A1AD',
    border: '#262B33',
    tint: '#6FA0F5',
    tintText: '#08101F',
    success: '#47C08A',
    warning: '#E3A83E',
    danger: '#E67971',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
// Web's tab bar (app-tabs.web.tsx) is an absolutely-positioned floating
// pill that overlays the top of the content instead of reserving its own
// layout space (unlike native's NativeTabs, a real native container) — screen
// content needs matching top clearance so titles don't render underneath it.
export const TopBarInset = Platform.select({ web: 72 }) ?? 0;
export const MaxContentWidth = 800;

// Below this viewport width, app-tabs.web.tsx's floating pill nav can't fit
// brand + sync indicator + 5 tab pills on one line (no flexWrap/overflow
// handling by design — a real hamburger + drawer collapse reads better at
// phone widths than a wrapped or scrolling pill) and switches to a hamburger
// + slide-in drawer instead.
export const NavBreakpoint = 800;

// Below this viewport width, AmountCurrencyField (Stage 11 redesign)
// stacks its amount field and currency picker into a column instead of a
// row — a much smaller threshold than NavBreakpoint since two form fields
// need far less width than the full nav bar. Native screens are always
// narrower than this, so they always render as a column with no
// platform-split file needed.
export const FormRowBreakpoint = 480;

// SRS §4 — touch targets should match patterns users already recognize;
// 44x44 is the iOS HIG / WCAG 2.5.5 minimum.
export const MinTouchTarget = 44;
