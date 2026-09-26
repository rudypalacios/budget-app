import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import type { SyncStatus } from '@/components/sync-status-indicator';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { getCurrencySymbol } from '@/constants/currencies';
import { getLanguageLabel } from '@/constants/languages';
import { Spacing } from '@/constants/theme';
import { DefaultCurrencySheet } from '@/features/settings/default-currency-sheet';
import { LanguageSheet } from '@/features/settings/language-sheet';
import { RemindersSection } from '@/features/settings/reminders-section';
import { saveSettings } from '@/features/settings/save-settings';
import { SegmentedControl } from '@/features/settings/segmented-control';
import { SettingsCard } from '@/features/settings/settings-card';
import { SettingsRow } from '@/features/settings/settings-row';
import { SettingsSectionTitle } from '@/features/settings/settings-section-title';
import { TrashRetentionSheet } from '@/features/settings/trash-retention-sheet';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';
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

const SYNC_STATUS_LABEL_KEY: Record<SyncStatus, string> = {
  synced: 'syncStatus.synced',
  pending: 'syncStatus.syncing',
  offline: 'syncStatus.offline',
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
  const staleCurrencyCount = addedCurrencies.filter(
    (currency) => currency.status === 'stale',
  ).length;
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
        <SettingsSectionTitle title={t('settings.account.title')} />
        {isAnonymous ? (
          <SettingsCard>
            <SettingsRow
              title={t('settings.account.createOrLogIn')}
              subtitle={t('settings.account.anonymousHint')}
              onPress={() => router.push('/(auth)/login' as Href)}
            />
          </SettingsCard>
        ) : (
          <SettingsCard>
            <SettingsRow
              icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              title={email ?? ''}
              subtitle={<AccountSyncLine />}
            />
            {/* Signs out directly, as before this redesign (doc §4.1: no
                behavior change) — the prototype's extra confirm sheet is not
                adopted. */}
            <SettingsRow
              title={t('common.signOut')}
              trailingIcon={{
                ios: 'rectangle.portrait.and.arrow.right',
                android: 'logout',
                web: 'logout',
              }}
              onPress={signOutAndRestartAnonymous}
            />
          </SettingsCard>
        )}
      </View>

      <View style={styles.section}>
        <SettingsSectionTitle title={t('settings.general.title')} />
        <SettingsCard>
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
          <View style={styles.themeRow}>
            <ThemedText type="smallBold">{t('settings.general.theme')}</ThemedText>
            {/* No toast for theme (RN-AJU-6): the whole screen re-themes
                instantly, which is its own confirmation. */}
            <SegmentedControl
              options={THEMES.map((option) => ({
                value: option,
                label: t(THEME_LABEL_KEY[option]),
              }))}
              value={settings.theme}
              onChange={(theme) => saveSettings({ theme })}
            />
          </View>
        </SettingsCard>
      </View>

      <View style={styles.section}>
        <SettingsSectionTitle title={t('settings.manage.title')} />
        <SettingsCard>
          <SettingsRow
            icon={{ ios: 'dollarsign.circle', android: 'paid', web: 'paid' }}
            title={t('settings.currencies.title')}
            value={t('settings.currencies.addedCount', { count: addedCurrencies.length })}
            badge={
              staleCurrencyCount > 0 ? (
                <Chip
                  size="small"
                  tone="warning"
                  label={t('settings.currencies.staleCount', { count: staleCurrencyCount })}
                />
              ) : undefined
            }
            // expo-router's typed-routes generator doesn't emit the collapsed
            // '/currencies' alias for a plain (non-group) folder's index.tsx —
            // only the file-relative 'currencies/index' form, which 404s at
            // runtime (verified: '/categories' -> 200, '/categories/index' ->
            // 404). Cast around the incorrect type until upstream fixes this;
            // the same applies to every sub-screen route below.
            onPress={() => router.push('/currencies' as Href)}
          />
          <SettingsRow
            icon={{ ios: 'wrench.and.screwdriver', android: 'build', web: 'build' }}
            title={t('settings.categories.title')}
            value={t('settings.categories.count', { count: categories.length })}
            onPress={() => router.push('/categories' as Href)}
          />
          <SettingsRow
            icon={{ ios: 'folder', android: 'folder', web: 'folder' }}
            title={t('settings.recurringGroups.title')}
            value={t('settings.recurringGroups.count', { count: recurringGroups.length })}
            onPress={() => router.push('/recurring-groups' as Href)}
          />
        </SettingsCard>
      </View>

      <View style={styles.section}>
        <SettingsSectionTitle title={t('settings.reminders.title')} />
        <RemindersSection reminders={settings.reminders} />
      </View>

      <View style={styles.section}>
        <SettingsSectionTitle title={t('settings.data.title')} />
        <SettingsCard>
          <SettingsRow
            title={t('settings.data.trashRetentionSheetTitle')}
            value={t('settings.data.trashRetentionOption', { count: settings.trashRetentionDays })}
            onPress={() => setOpenSheet('trashRetention')}
          />
          <SettingsRow
            icon={{ ios: 'archivebox', android: 'archive', web: 'archive' }}
            title={t('settings.data.archive')}
            value={t('settings.data.archiveCount', { count: archivedCount })}
            onPress={() => router.push('/archive' as Href)}
          />
          <SettingsRow
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            title={t('settings.data.trash')}
            value={t('settings.data.trashItemCount', { count: trashedCount })}
            onPress={() => router.push('/trash' as Href)}
          />
        </SettingsCard>
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

// The account row's second line: the real sync status (useSyncStatus, the
// same source as the header indicator), with the prototype's check icon once
// synced.
function AccountSyncLine() {
  const { t } = useTranslation();
  const theme = useTheme();
  const status = useSyncStatus();

  return (
    <View style={styles.syncLine}>
      {status === 'synced' && (
        <SymbolView
          name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
          size={13}
          tintColor={theme.textSecondary}
        />
      )}
      <ThemedText type="caption">{t(SYNC_STATUS_LABEL_KEY[status])}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.one + 2,
  },
  themeRow: {
    gap: Spacing.one + 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  syncLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
