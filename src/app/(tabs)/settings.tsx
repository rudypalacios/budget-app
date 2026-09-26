import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { SectionHeader } from '@/components/ui/section-header';
import { getCurrencySymbol } from '@/constants/currencies';
import { getLanguageLabel } from '@/constants/languages';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { DefaultCurrencySheet } from '@/features/settings/default-currency-sheet';
import { LanguageSheet } from '@/features/settings/language-sheet';
import { RemindersSection } from '@/features/settings/reminders-section';
import { saveSettings } from '@/features/settings/save-settings';
import { SettingsRow } from '@/features/settings/settings-row';
import { TrashRetentionSheet } from '@/features/settings/trash-retention-sheet';
import { collectArchivedRecords, collectTrashedRecords } from '@/lib/lifecycle-records';
import type { SupportedLanguage } from '@/localization/i18n';
import { useCategoriesStore } from '@/store/categories';
import { useCurrenciesStore } from '@/store/currencies';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringGroupsStore } from '@/store/recurring-groups';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { signOutAndRestartAnonymous, useSessionStore } from '@/store/session';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';
import type { UserSettings } from '@/types/firestore';

const THEMES = ['light', 'dark', 'system'] as const;
const THEME_LABEL_KEY: Record<(typeof THEMES)[number], string> = {
  light: 'settings.general.themeOption.light',
  dark: 'settings.general.themeOption.dark',
  system: 'settings.general.themeOption.system',
};

type OpenSheet = 'currency' | 'language' | 'trashRetention' | null;

// Every control writes the moment it changes — there is no Save button and
// no unsaved state (Ajustes redesign, RN-AJU-1; this reverses Stage 10's
// single-Save decision on purpose, see .claude/design/pages/02-ajustes.md
// §1). The screen reads straight from the settings store, which the local
// Firestore cache updates instantly, online or not.
export default function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useUserSettingsStore((state) => state.data);

  if (!settings) {
    return (
      <ScreenScroll>
        <ScreenHeader title={t('settings.title')} />
      </ScreenScroll>
    );
  }

  return <SettingsContent settings={settings} />;
}

function SettingsContent({ settings }: { settings: UserSettings }) {
  const { t } = useTranslation();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);

  const categories = useCategoriesStore((state) => state.items);
  const addedCurrencies = useCurrenciesStore((state) => state.items);
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const recurringGroups = useRecurringGroupsStore((state) => state.items).filter(
    (group) => group.lifecycleState !== 'trashed',
  );
  const email = useSessionStore((state) => state.email);
  const isAnonymous = useSessionStore((state) => state.isAnonymous);

  const archivedCount = collectArchivedRecords(
    expenses,
    incomes,
    recurringExpenses,
    recurringIncomes,
    categories,
  ).length;
  const trashedCount = collectTrashedRecords(
    expenses,
    incomes,
    recurringExpenses,
    recurringIncomes,
  ).length;

  function closeSheet() {
    setOpenSheet(null);
  }

  function handleCurrencyConfirmed(currency: string) {
    // updateUserSettings itself chains the currency side effects (mark added
    // currencies + budget recommendations stale) — nothing extra here.
    saveSettings({ defaultCurrency: currency });
    showToast(t('settings.general.currencyChanged', { currency }));
  }

  function handleLanguageSelected(language: SupportedLanguage) {
    // No i18n.changeLanguage() here: _layout.tsx already switches i18next
    // whenever the persisted language changes, and the local cache applies
    // this write immediately. The toast is rendered with `lng` so it reads in
    // the newly chosen language, since that switch hasn't happened yet.
    saveSettings({ language });
    showToast(
      t('settings.general.languageChanged', {
        lng: language,
        language: getLanguageLabel(language),
      }),
    );
  }

  function handleTrashRetentionSelected(days: number) {
    saveSettings({ trashRetentionDays: days });
    showToast(t('settings.data.trashRetentionChanged', { count: days }));
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('settings.title')} />

      <View style={styles.section}>
        <SectionHeader title={t('settings.account.title')} />
        {isAnonymous ? (
          <SettingsRow
            title={t('settings.account.createOrLogIn')}
            onPress={() => router.push('/(auth)/login' as Href)}
          />
        ) : (
          <Card style={styles.accountRow}>
            <ThemedText type="smallBold" style={styles.accountEmail}>
              {email}
            </ThemedText>
            <Button
              label={t('common.signOut')}
              variant="ghost"
              onPress={signOutAndRestartAnonymous}
            />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.general.title')} />
        <SettingsRow
          title={t('settings.general.defaultCurrency')}
          value={`${getCurrencySymbol(settings.defaultCurrency)} (${settings.defaultCurrency})`}
          onPress={() => setOpenSheet('currency')}
        />
        <SettingsRow
          title={t('settings.general.language')}
          value={getLanguageLabel(settings.language)}
          onPress={() => setOpenSheet('language')}
        />
        <Card style={styles.card}>
          <ThemedText type="smallBold">{t('settings.general.theme')}</ThemedText>
          <View style={styles.chipRow}>
            {THEMES.map((option) => {
              const isSelected = settings.theme === option;
              return (
                // No toast for theme (RN-AJU-6): the whole screen re-themes
                // instantly, which is its own confirmation.
                <Pressable
                  key={option}
                  onPress={() => {
                    if (!isSelected) saveSettings({ theme: option });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(THEME_LABEL_KEY[option])}
                  accessibilityState={{ selected: isSelected }}
                  style={styles.chipTarget}
                >
                  <Chip
                    label={t(THEME_LABEL_KEY[option])}
                    tone={isSelected ? 'success' : 'neutral'}
                  />
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.categories.title')} />
        <SettingsRow
          title={t('settings.categories.manage')}
          caption={t('settings.categories.count', { count: categories.length })}
          // expo-router's typed-routes generator doesn't emit the collapsed
          // '/categories' alias for a plain (non-group) folder's index.tsx —
          // only the file-relative 'categories/index' form, which 404s at
          // runtime (verified: '/categories' -> 200, '/categories/index' ->
          // 404). Cast around the incorrect type until upstream fixes this;
          // the same applies to every sub-screen route below.
          onPress={() => router.push('/categories' as Href)}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.currencies.title')} />
        <SettingsRow
          title={t('settings.currencies.manage')}
          caption={t('settings.currencies.count', { count: addedCurrencies.length })}
          onPress={() => router.push('/currencies' as Href)}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.recurringGroups.title')} />
        <SettingsRow
          title={t('settings.recurringGroups.manage')}
          caption={t('settings.recurringGroups.count', { count: recurringGroups.length })}
          onPress={() => router.push('/recurring-groups' as Href)}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.reminders.title')} />
        <RemindersSection reminders={settings.reminders} />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.data.title')} />
        <SettingsRow
          title={t('settings.data.trashRetentionSheetTitle')}
          value={t('settings.data.trashRetentionOption', { count: settings.trashRetentionDays })}
          onPress={() => setOpenSheet('trashRetention')}
        />
        <SettingsRow
          title={t('settings.data.archive')}
          caption={t('settings.data.archiveCount', { count: archivedCount })}
          onPress={() => router.push('/archive' as Href)}
        />
        <SettingsRow
          title={t('settings.data.trash')}
          caption={t('settings.data.trashCount', { count: trashedCount })}
          onPress={() => router.push('/trash' as Href)}
        />
      </View>

      <DefaultCurrencySheet
        isOpen={openSheet === 'currency'}
        onClose={closeSheet}
        currentCurrency={settings.defaultCurrency}
        onConfirm={handleCurrencyConfirmed}
      />
      <LanguageSheet
        isOpen={openSheet === 'language'}
        onClose={closeSheet}
        currentLanguage={settings.language}
        onSelect={handleLanguageSelected}
      />
      <TrashRetentionSheet
        isOpen={openSheet === 'trashRetention'}
        onClose={closeSheet}
        currentDays={settings.trashRetentionDays}
        onSelect={handleTrashRetentionSelected}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  // Pads the chip's hit area up to the 44pt minimum without enlarging the
  // chip itself.
  chipTarget: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  accountEmail: {
    flexShrink: 1,
  },
});
