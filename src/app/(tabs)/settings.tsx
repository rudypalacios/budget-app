import { router, type Href } from 'expo-router';
import { useState } from 'react';
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
import { Spacing } from '@/constants/theme';
import { useCategoriesStore } from '@/store/categories';
import { signOutAndRestartAnonymous, useSessionStore } from '@/store/session';

const CURRENCIES = [
  { value: 'GTQ', label: 'GTQ — Guatemalan Quetzal' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
] as const;
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const;
const THEMES = ['light', 'dark', 'system'] as const;

// Local-only still — these pickers don't yet change the app's active
// theme/language/currency. That's Stage 9 (localization) plus a
// users/{uid} settings-doc store this stage didn't need (no screen reads
// UserSettings yet); this screen is just the settings UI shell.
// Categories are the exception — FR-9's centrally managed list reads from
// the real categoriesStore (Stage 6). Management itself lives on its own
// /categories screen; Settings is just the entry point.
export default function SettingsScreen() {
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]['value']>('GTQ');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]['value']>('en');
  const [theme, setTheme] = useState<(typeof THEMES)[number]>('system');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [leadDays, setLeadDays] = useState('1');
  const [trashRetentionDays, setTrashRetentionDays] = useState('30');

  const categories = useCategoriesStore((state) => state.items);
  const email = useSessionStore((state) => state.email);
  const isAnonymous = useSessionStore((state) => state.isAnonymous);

  return (
    <ScreenScroll>
      <ScreenHeader title="Settings" />

      <View style={styles.section}>
        <SectionHeader title="Account" />
        {isAnonymous ? (
          <Pressable
            onPress={() => router.push('/(auth)/login' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Create account or log in"
          >
            <Card style={styles.manageRow}>
              <ThemedText type="smallBold">Create account / Log in</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Card>
          </Pressable>
        ) : (
          <Card style={styles.manageRow}>
            <ThemedText type="smallBold">{email}</ThemedText>
            <Button label="Sign Out" variant="ghost" onPress={signOutAndRestartAnonymous} />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="General" />
        <Card style={styles.card}>
          <Select label="Default currency" value={currency} options={CURRENCIES} onChange={setCurrency} />
          <Select label="Language" value={language} options={LANGUAGES} onChange={setLanguage} />

          <ThemedText type="smallBold" themeColor="textSecondary">
            Theme
          </ThemedText>
          <View style={styles.chipRow}>
            {THEMES.map((option) => (
              <Pressable key={option} onPress={() => setTheme(option)}>
                <Chip label={option} tone={theme === option ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Categories" />
        <Pressable
          // expo-router's typed-routes generator doesn't emit the collapsed
          // '/categories' alias for a plain (non-group) folder's index.tsx —
          // only the file-relative 'categories/index' form, which 404s at
          // runtime (verified: '/categories' -> 200, '/categories/index' ->
          // 404). Cast around the incorrect type until upstream fixes this.
          onPress={() => router.push('/categories' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Manage categories"
        >
          <Card style={styles.manageRow}>
            <View>
              <ThemedText type="smallBold">Manage categories</ThemedText>
              <ThemedText type="caption">{categories.length} categories</ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Card>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Reminders" />
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <Switch
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
              accessibilityLabel="Enable reminders"
            />
            <ThemedText>Enable reminders</ThemedText>
          </View>
          {remindersEnabled && (
            <TextField
              label="Lead days"
              value={leadDays}
              onChangeText={setLeadDays}
              keyboardType="number-pad"
            />
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Data" />
        <Card style={styles.card}>
          <TextField
            label="Trash retention (days)"
            value={trashRetentionDays}
            onChangeText={setTrashRetentionDays}
            keyboardType="number-pad"
          />
        </Card>
      </View>

      {!isAnonymous && (
        // Duplicated here deliberately: the Account-card action above is for
        // discoverability (found live that a single Sign Out at the very
        // bottom of a long page was too easy to miss), while this one keeps
        // the common Facebook/GitHub convention of also having sign-out as
        // the last action on the page.
        <View style={styles.section}>
          <Button label="Sign Out" variant="ghost" onPress={signOutAndRestartAnonymous} />
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
