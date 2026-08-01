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
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { useCategoriesStore } from '@/store/categories';
import { useCurrenciesStore } from '@/store/currencies';
import { signOutAndRestartAnonymous, useSessionStore } from '@/store/session';
import { updateUserSettings, useUserSettingsStore } from '@/store/user-settings';
import type { UserSettings } from '@/types/firestore';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const;
const THEMES = ['light', 'dark', 'system'] as const;
const THEME_LABEL_KEY: Record<(typeof THEMES)[number], string> = {
  light: 'settings.general.themeOption.light',
  dark: 'settings.general.themeOption.dark',
  system: 'settings.general.themeOption.system',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const isLoading = useUserSettingsStore((state) => state.isLoading);
  const settings = useUserSettingsStore((state) => state.data);

  // Gated on the settings doc having loaded (or been seeded — see
  // _layout.tsx) so SettingsForm's local draft state below initializes from
  // real values exactly once, the same initialValues-on-mount pattern
  // expense-form.tsx/category-form.tsx use.
  if (isLoading || !settings) {
    return (
      <ScreenScroll>
        <ScreenHeader title={t('settings.title')} />
      </ScreenScroll>
    );
  }

  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: UserSettings }) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<UserSettings['defaultCurrency']>(settings.defaultCurrency);
  const [language, setLanguage] = useState<UserSettings['language']>(settings.language);
  const [theme, setTheme] = useState<UserSettings['theme']>(settings.theme);
  const [remindersEnabled, setRemindersEnabled] = useState(settings.reminders.enabled);
  const [leadDays, setLeadDays] = useState(String(settings.reminders.leadDays));
  const [trashRetentionDays, setTrashRetentionDays] = useState(String(settings.trashRetentionDays));

  const categories = useCategoriesStore((state) => state.items);
  const addedCurrencies = useCurrenciesStore((state) => state.items);
  const email = useSessionStore((state) => state.email);
  const isAnonymous = useSessionStore((state) => state.isAnonymous);

  async function handleSave() {
    await updateUserSettings({
      defaultCurrency: currency,
      language,
      theme,
      trashRetentionDays: Number(trashRetentionDays),
      reminders: {
        enabled: remindersEnabled,
        leadDays: Number(leadDays),
        timeOfDay: settings.reminders.timeOfDay,
      },
    });
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('settings.title')} />

      <View style={styles.section}>
        <SectionHeader title={t('settings.account.title')} />
        {isAnonymous ? (
          <Pressable
            onPress={() => router.push('/(auth)/login' as Href)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.account.createOrLogIn')}
          >
            <Card style={styles.manageRow}>
              <ThemedText type="smallBold">{t('settings.account.createOrLogIn')}</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Card>
          </Pressable>
        ) : (
          <Card style={styles.manageRow}>
            <ThemedText type="smallBold">{email}</ThemedText>
            <Button label={t('common.signOut')} variant="ghost" onPress={signOutAndRestartAnonymous} />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.general.title')} />
        <Card style={styles.card}>
          <Select
            label={t('settings.general.defaultCurrency')}
            value={currency}
            options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
            onChange={setCurrency}
          />
          <Select
            label={t('settings.general.language')}
            value={language}
            options={LANGUAGES}
            onChange={setLanguage}
          />

          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.general.theme')}
          </ThemedText>
          <View style={styles.chipRow}>
            {THEMES.map((option) => (
              <Pressable key={option} onPress={() => setTheme(option)}>
                <Chip label={t(THEME_LABEL_KEY[option])} tone={theme === option ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.categories.title')} />
        <Pressable
          // expo-router's typed-routes generator doesn't emit the collapsed
          // '/categories' alias for a plain (non-group) folder's index.tsx —
          // only the file-relative 'categories/index' form, which 404s at
          // runtime (verified: '/categories' -> 200, '/categories/index' ->
          // 404). Cast around the incorrect type until upstream fixes this.
          onPress={() => router.push('/categories' as Href)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.categories.manage')}
        >
          <Card style={styles.manageRow}>
            <View>
              <ThemedText type="smallBold">{t('settings.categories.manage')}</ThemedText>
              <ThemedText type="caption">{t('settings.categories.count', { count: categories.length })}</ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Card>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.currencies.title')} />
        <Pressable
          // Same expo-router typed-routes workaround as the Categories
          // section above — see its comment for why the cast is needed.
          onPress={() => router.push('/currencies' as Href)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.currencies.manage')}
        >
          <Card style={styles.manageRow}>
            <View>
              <ThemedText type="smallBold">{t('settings.currencies.manage')}</ThemedText>
              <ThemedText type="caption">
                {t('settings.currencies.count', { count: addedCurrencies.length })}
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Card>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.reminders.title')} />
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <Switch
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
              accessibilityLabel={t('settings.reminders.enable')}
            />
            <ThemedText>{t('settings.reminders.enable')}</ThemedText>
          </View>
          {remindersEnabled && (
            <TextField
              label={t('settings.reminders.leadDays')}
              value={leadDays}
              onChangeText={setLeadDays}
              keyboardType="number-pad"
            />
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.data.title')} />
        <Card style={styles.card}>
          <TextField
            label={t('settings.data.trashRetention')}
            value={trashRetentionDays}
            onChangeText={setTrashRetentionDays}
            keyboardType="number-pad"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Button label={t('common.save')} onPress={handleSave} />
      </View>

      {!isAnonymous && (
        // Duplicated here deliberately: the Account-card action above is for
        // discoverability (found live that a single Sign Out at the very
        // bottom of a long page was too easy to miss), while this one keeps
        // the common Facebook/GitHub convention of also having sign-out as
        // the last action on the page.
        <View style={styles.section}>
          <Button label={t('common.signOut')} variant="ghost" onPress={signOutAndRestartAnonymous} />
        </View>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
