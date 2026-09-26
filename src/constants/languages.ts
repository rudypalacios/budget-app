import type { SupportedLanguage } from '@/localization/i18n';

// Each language's name is written in that language itself (not translated),
// so a user who can't read the current UI language can still find their own.
export const LANGUAGES: readonly { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

export function getLanguageLabel(value: string): string {
  return LANGUAGES.find((language) => language.value === value)?.label ?? value;
}
