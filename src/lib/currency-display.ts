import type { TFunction } from 'i18next';

// "Dólar estadounidense (USD)" — the currency's name in the app's language,
// plus its code. SUPPORTED_CURRENCIES' own `label` is English-only, so the
// translated name comes from `currencies.names.*` (Ajustes redesign); a code
// with no translation falls back to the bare code.
export function currencyDisplayName(code: string, t: TFunction): string {
  const name = t(`currencies.names.${code}`, { defaultValue: code });
  return name === code ? code : `${name} (${code})`;
}
