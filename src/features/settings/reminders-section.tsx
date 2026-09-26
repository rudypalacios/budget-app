import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Switch } from '@/components/ui/switch';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createDebouncedWriter } from '@/lib/debounce';
import { showToast } from '@/store/toast';
import { useUserSettingsStore } from '@/store/user-settings';
import type { UserSettings } from '@/types/firestore';

import { OptionRow } from './option-row';
import { saveSettings } from './save-settings';
import { SettingsCard } from './settings-card';
import { SettingsRow } from './settings-row';

// A bounded range instead of free text (RN-AJU-3), so write-on-change never
// persists a half-typed value.
const MIN_LEAD_DAYS = 1;
const MAX_LEAD_DAYS = 14;
// Long enough to swallow a burst of quick taps ("+" four times → one write),
// short enough that the value is saved well before the user moves on.
const LEAD_DAYS_WRITE_DELAY_MS = 400;
// Fixed choices for when a reminder arrives (ajustes-v2 prototype); null =
// no fixed time. Stored as-is in reminders.timeOfDay ("HH:MM", 24h).
const TIME_OF_DAY_OPTIONS = [null, '08:00', '09:00', '12:00', '18:00', '20:00'] as const;

// "08:00" -> "8:00", as the prototype shows it.
function formatTimeOfDay(time: string): string {
  return time.replace(/^0/, '');
}

export type RemindersSectionProps = {
  reminders: UserSettings['reminders'];
};

export function RemindersSection({ reminders }: RemindersSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isTimeSheetOpen, setIsTimeSheetOpen] = useState(false);

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

  function handleTimeOfDayChange(timeOfDay: string | null) {
    setIsTimeSheetOpen(false);
    if (timeOfDay === reminders.timeOfDay) return;
    // Same folding-in of a pending stepper write as handleEnabledChange.
    leadDaysWriter.cancel();
    saveSettings({ reminders: { ...reminders, leadDays, timeOfDay } });
    showToast(
      timeOfDay
        ? t('settings.reminders.timeChanged', { time: formatTimeOfDay(timeOfDay) })
        : t('settings.reminders.timeCleared'),
    );
  }

  function timeLabel(timeOfDay: string | null): string {
    return timeOfDay ? formatTimeOfDay(timeOfDay) : t('settings.reminders.noFixedTime');
  }

  function step(delta: 1 | -1) {
    const next = Math.min(MAX_LEAD_DAYS, Math.max(MIN_LEAD_DAYS, leadDays + delta));
    if (next === leadDays) return;
    setLeadDays(next);
    leadDaysWriter.schedule(next);
  }

  return (
    <>
      <SettingsCard>
        <View style={styles.row}>
          <View style={styles.text}>
            <ThemedText type="smallBold">{t('settings.reminders.enable')}</ThemedText>
            <ThemedText type="caption">{t('settings.reminders.enableHint')}</ThemedText>
          </View>
          <Switch
            value={reminders.enabled}
            onValueChange={handleEnabledChange}
            accessibilityLabel={t('settings.reminders.enable')}
          />
        </View>

        {reminders.enabled && (
          <View style={styles.row}>
            <ThemedText type="smallBold" style={styles.text}>
              {t('settings.reminders.leadDays')}
            </ThemedText>
            <View style={styles.stepper}>
              <StepperButton
                glyph="−"
                onPress={() => step(-1)}
                disabled={leadDays <= MIN_LEAD_DAYS}
                accessibilityLabel={t('settings.reminders.leadDaysDecrease')}
                borderColor={theme.border}
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
              <StepperButton
                glyph="+"
                onPress={() => step(1)}
                disabled={leadDays >= MAX_LEAD_DAYS}
                accessibilityLabel={t('settings.reminders.leadDaysIncrease')}
                borderColor={theme.border}
              />
            </View>
          </View>
        )}

        {reminders.enabled && (
          <SettingsRow
            title={t('settings.reminders.timeOfDay')}
            value={timeLabel(reminders.timeOfDay)}
            onPress={() => setIsTimeSheetOpen(true)}
          />
        )}
      </SettingsCard>

      <ActionSheet
        isOpen={isTimeSheetOpen}
        onClose={() => setIsTimeSheetOpen(false)}
        title={t('settings.reminders.timeOfDay')}
      >
        <View>
          {TIME_OF_DAY_OPTIONS.map((option) => (
            <OptionRow
              key={option ?? 'none'}
              label={timeLabel(option)}
              isSelected={option === reminders.timeOfDay}
              onPress={() => handleTimeOfDayChange(option)}
            />
          ))}
        </View>
      </ActionSheet>
    </>
  );
}

type StepperButtonProps = {
  glyph: string;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  borderColor: string;
};

// The prototype's bordered −/+ squares (`.stp button`).
function StepperButton({
  glyph,
  onPress,
  disabled,
  accessibilityLabel,
  borderColor,
}: StepperButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.stepperButton,
        { borderColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <ThemedText type="default">{glyph}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    minHeight: 56,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  text: {
    flex: 1,
    minWidth: 140,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  stepperButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed width so the buttons don't shift between 9 and 10.
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
});
