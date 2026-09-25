import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  // linkPrimary reads as an accent link, not body text, and caption as
  // muted metadata — both default away from `text` so they follow theme
  // switches instead of a color baked into the style.
  const defaultThemeColor =
    type === 'linkPrimary' ? 'tint' : type === 'caption' ? 'textSecondary' : 'text';

  return (
    <Text
      style={[
        { color: theme[themeColor ?? defaultThemeColor] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'caption' && styles.caption,
        style,
      ]}
      {...rest}
    />
  );
}

// Redesign typography (v9 prototype): regular 400 for body text and medium
// 500 for emphasis — the prototype never goes bolder than 500. `title` is
// the page title (22px), not a hero headline.
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 400,
  },
  title: {
    fontSize: 22,
    fontWeight: 500,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 500,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 400,
  },
});
