import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { createDebouncedWriter } from '@/lib/debounce';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';
import type { UserSettings } from '@/types/firestore';

import { saveSettings } from './save-settings';

// A bounded range instead of free text (RN-AJU-3), so write-on-change never
// persists a half-typed value.
const MIN_LEAD_DAYS = 1;
const MAX_LEAD_DAYS = 14;
// Long enough to swallow a burst of quick taps ("+" four times → one write),
// short enough that the value is saved well before the user moves on.
const LEAD_DAYS_WRITE_DELAY_MS = 400;

export type RemindersSectionProps = {
  reminders: UserSettings['reminders'];
};

export function RemindersSection({ reminders }: RemindersSectionProps) {
  const { t } = useTranslation();

  // The stepper's number updates on every tap from local state; only the
  // Firestore write is debounced (§4.5).
  const [leadDays, setLeadDays] = useState(reminders.leadDays);
  // Re-sync local state when the persisted value changes underneath us (our
  // own write echoing back, or another device) — React's documented
  // "adjust state while rendering" pattern rather than an effect.
  const [syncedLeadDays, setSyncedLeadDays] = useState(reminders.leadDays);
  if (reminders.leadDays !== syncedLeadDays) {
    setSyncedLeadDays(reminders.leadDays);
    setLeadDays(reminders.leadDays);
  }

  // `reminders` is one Firestore map field, written whole — so the delayed
  // write merges into the *latest* stored reminders at fire time, not the
  // props from when it was scheduled, or it could undo a newer change.
  const [leadDaysWriter] = useState(() =>
    createDebouncedWriter<number>((days) => {
      const latest = useUserSettingsStore.getState().data?.reminders;
      if (!latest) return;
      saveSettings({ reminders: { ...latest, leadDays: days } });
    }, LEAD_DAYS_WRITE_DELAY_MS),
  );

  // Leaving the screen mid-debounce still saves the last value.
  useEffect(() => () => leadDaysWriter.flush(), [leadDaysWriter]);

  function handleEnabledChange(enabled: boolean) {
    // Carries the on-screen leadDays in the same write, so a still-pending
    // stepper write is folded in here rather than racing it.
    leadDaysWriter.cancel();
    saveSettings({ reminders: { ...reminders, enabled, leadDays } });
    showToast(t(enabled ? 'settings.reminders.enabledOn' : 'settings.reminders.enabledOff'));
  }

  function step(delta: 1 | -1) {
    const next = Math.min(MAX_LEAD_DAYS, Math.max(MIN_LEAD_DAYS, leadDays + delta));
    if (next === leadDays) return;
    setLeadDays(next);
    leadDaysWriter.schedule(next);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ThemedText style={styles.label}>{t('settings.reminders.enable')}</ThemedText>
        <Switch
          value={reminders.enabled}
          onValueChange={handleEnabledChange}
          accessibilityLabel={t('settings.reminders.enable')}
        />
      </View>

      {reminders.enabled && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>{t('settings.reminders.leadDays')}</ThemedText>
          <View style={styles.stepper}>
            <IconButton
              name={{ ios: 'minus', android: 'remove', web: 'remove' }}
              onPress={() => step(-1)}
              disabled={leadDays <= MIN_LEAD_DAYS}
              accessibilityLabel={t('settings.reminders.leadDaysDecrease')}
            />
            <ThemedText
              type="smallBold"
              style={styles.stepperValue}
              accessibilityLabel={t('settings.reminders.leadDaysValue', { count: leadDays })}
              // Announces the new value after each tap (Android + web
              // aria-live; iOS VoiceOver reads the button's result itself).
              accessibilityLiveRegion="polite"
            >
              {leadDays}
            </ThemedText>
            <IconButton
              name={{ ios: 'plus', android: 'add', web: 'add' }}
              onPress={() => step(1)}
              disabled={leadDays >= MAX_LEAD_DAYS}
              accessibilityLabel={t('settings.reminders.leadDaysIncrease')}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
    minWidth: 140,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Fixed width so the buttons don't shift between 9 and 10.
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
  },
});
