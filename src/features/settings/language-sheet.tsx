import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { TextField } from '@/components/ui/text-field';
import { LANGUAGES } from '@/constants/languages';
import { normalizeSearchText } from '@/lib/search-text';
import type { SupportedLanguage } from '@/localization/i18n';

import { OptionRow } from './option-row';

export type LanguageSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: string;
  onSelect: (language: SupportedLanguage) => void;
};

// Below this many languages a plain list is quicker than typing, so the
// search field stays hidden (Ajustes redesign, §4.3). The filter is wired
// regardless so adding languages later needs no change here.
const SEARCH_THRESHOLD = 8;

export function LanguageSheet({ isOpen, onClose, currentLanguage, onSelect }: LanguageSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const showSearch = LANGUAGES.length > SEARCH_THRESHOLD;

  const normalizedQuery = normalizeSearchText(query);
  const visibleLanguages = LANGUAGES.filter((language) =>
    normalizeSearchText(language.label).includes(normalizedQuery),
  );

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <ActionSheet isOpen={isOpen} onClose={close} title={t('settings.general.language')}>
      {showSearch && (
        <TextField
          label={t('settings.general.searchLanguage')}
          value={query}
          onChangeText={setQuery}
        />
      )}
      <View>
        {visibleLanguages.map((language) => (
          <OptionRow
            key={language.value}
            label={language.label}
            isSelected={language.value === currentLanguage}
            onPress={() => {
              if (language.value !== currentLanguage) onSelect(language.value);
              close();
            }}
          />
        ))}
        {visibleLanguages.length === 0 && (
          <ThemedText type="caption">{t('settings.general.noLanguageResults')}</ThemedText>
        )}
      </View>
    </ActionSheet>
  );
}
