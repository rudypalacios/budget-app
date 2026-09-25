/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Palette from the redesign prototype (.claude/design/prototypes/presupuesto-v9.html):
// warm neutral surfaces instead of the original blue-black, so cards read
// clearly against the page. Mapping from the prototype's CSS variables:
// background = surface-0 (page), backgroundElement = surface-2 (cards),
// backgroundSelected = surface-1 (tracks, pressed/neutral fills), and the
// *Surface tokens = its bg-* tints behind colored chips/notices. Text colors
// meet WCAG AA (>= 4.5:1) on both background and backgroundElement.
export const Colors = {
  light: {
    text: '#141413',
    background: '#FAF9F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F0EEE6',
    textSecondary: '#5E5D59',
    border: 'rgba(20,20,19,0.12)',
    tint: '#185FA5',
    tintText: '#FFFFFF',
    success: '#3B6D11',
    warning: '#854F0B',
    danger: '#A32D2D',
    tintSurface: '#E6F1FB',
    successSurface: '#EAF3DE',
    warningSurface: '#FAEEDA',
    dangerSurface: '#FCEBEB',
    // The "exact" budget bar: a brighter fill than `success`, which is tuned
    // for text contrast rather than for a thin bar.
    successFill: '#97C459',
  },
  dark: {
    text: '#FAF9F5',
    background: '#1A1A19',
    backgroundElement: '#30302E',
    backgroundSelected: '#262624',
    textSecondary: '#B0AEA5',
    border: 'rgba(250,249,245,0.14)',
    tint: '#85B7EB',
    tintText: '#042C53',
    success: '#97C459',
    warning: '#EF9F27',
    danger: '#F09595',
    tintSurface: '#0C447C',
    successSurface: '#27500A',
    warningSurface: '#412402',
    dangerSurface: '#501313',
    successFill: '#97C459',
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
// Web's wide-viewport tab bar (app-tabs.web.tsx's floating pill, shown
// above NavBreakpoint) is an absolutely-positioned overlay that doesn't
// reserve its own layout space (unlike native's NativeTabs, a real native
// container) — screen content needs matching top clearance so titles don't
// render underneath it. Below NavBreakpoint the pill isn't shown at all
// (see WebBottomNavHeight instead), so this only matters on wide web.
export const TopBarInset = Platform.select({ web: 72 }) ?? 0;
export const MaxContentWidth = 800;

// Below this viewport width, app-tabs.web.tsx's floating pill nav can't fit
// brand + sync indicator + 5 tab pills on one line (no flexWrap/overflow
// handling by design) and switches to WebBottomNavHeight's fixed bottom tab
// bar instead — the mobile-web equivalent of native's NativeTabs bar.
export const NavBreakpoint = 800;

// Height reserved for WebBottomTabBar (app-tabs.web.tsx's compact-viewport
// bottom tab bar, shown below NavBreakpoint) — mirrors BottomTabInset's
// role, but for web's own bottom nav bar instead of native's real tab bar
// controller.
export const WebBottomNavHeight = 64;

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
