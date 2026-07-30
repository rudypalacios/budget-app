import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';

const FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const;
const FREQUENCY_LABEL_KEY: Record<(typeof FREQUENCIES)[number], string> = {
  monthly: 'income.frequency.monthly',
  biweekly: 'income.frequency.biweekly',
  weekly: 'income.frequency.weekly',
};

export type IncomeFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  isRecurring: boolean;
  frequency: (typeof FREQUENCIES)[number];
  dayOfMonth: string;
  // Only meaningful for one-time income — recurring instances keep their
  // own unpaid-until-settled lifecycle via the Payments dashboard, and use
  // dayOfMonth/frequency (above) instead of a fixed calendar date.
  paid: boolean;
  date: Date | null;
};

export type IncomeFormProps = {
  initialValues?: IncomeFormValues;
  submitLabel: string;
  onSubmit: (values: IncomeFormValues) => void | Promise<void>;
  onCancel: () => void;
  // Set on Edit — kind is immutable post-creation (firestore.rules'
  // unchanged('kind')), so an existing one-time income can never become
  // recurring in place, and vice versa. The toggle is hidden outright
  // rather than shown disabled, so it doesn't look like a control that
  // should do something.
  disableRecurringToggle?: boolean;
  // The amount field's currency label — the record's own saved currency on
  // Edit (never the live default-currency setting, which may have changed
  // since this record was created — see CLAUDE.md's Known Issues), or the
  // current default currency on Add. Passed by the caller rather than read
  // internally here, since only the caller knows which case applies.
  currency: string;
};

export function IncomeForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  disableRecurringToggle,
  currency,
}: IncomeFormProps) {
  const { t } = useTranslation();
  const categories = useCategoriesStore((state) => state.items);
  const incomeCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'income' || category.type === 'both'),
  );

  const [values, setValues] = useState<IncomeFormValues>(
    initialValues ?? {
      name: '',
      amount: '',
      categoryId: incomeCategories[0]?.id ?? '',
      isRecurring: false,
      frequency: 'monthly',
      dayOfMonth: '1',
      paid: false,
      date: null,
    },
  );

  const parsedAmount = parseAmountInput(values.amount);
  const isValid =
    !!values.name &&
    !!values.categoryId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (values.isRecurring || values.date !== null);

  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t('common.name')}
        value={values.name}
        onChangeText={(name) => setValues((current) => ({ ...current, name }))}
        placeholder={t('income.form.namePlaceholder')}
      />
      <TextField
        label={t('common.amountWithCurrency', { currency })}
        value={values.amount}
        onChangeText={(amount) => setValues((current) => ({ ...current, amount: sanitizeAmountInput(amount) }))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={t('income.form.amountPlaceholder')}
      />

      <Select
        label={t('common.category')}
        value={values.categoryId}
        options={incomeCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      {!disableRecurringToggle && (
        <View style={styles.switchRow}>
          <Switch
            value={values.isRecurring}
            onValueChange={(isRecurring) => setValues((current) => ({ ...current, isRecurring }))}
            accessibilityLabel={t('income.form.accessibility.recurring')}
          />
          <ThemedText>{t('income.form.recurringLabel')}</ThemedText>
        </View>
      )}

      {values.isRecurring && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('income.form.frequency')}
          </ThemedText>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((option) => (
              <Pressable
                key={option}
                disabled={disableRecurringToggle}
                onPress={() => setValues((current) => ({ ...current, frequency: option }))}
              >
                <Chip label={t(FREQUENCY_LABEL_KEY[option])} tone={values.frequency === option ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
          {/* anchorDate (weekly/biweekly) isn't exposed as a field — it
              defaults to the creation date, same as startDate. Unlike the
              one-time due date below, a recurring definition's start point
              isn't user-facing data worth editing after the fact. */}
          {values.frequency === 'monthly' && (
            <TextField
              label={t('income.form.dayOfMonth')}
              value={values.dayOfMonth}
              onChangeText={(dayOfMonth) => setValues((current) => ({ ...current, dayOfMonth }))}
              keyboardType="number-pad"
              editable={!disableRecurringToggle}
            />
          )}
        </>
      )}

      {!values.isRecurring && (
        <DatePicker
          label={t('income.form.dueDate')}
          value={values.date}
          onChange={(date) => setValues((current) => ({ ...current, date }))}
        />
      )}

      {!values.isRecurring && (
        <View style={styles.switchRow}>
          <Switch
            value={values.paid}
            onValueChange={(paid) => setValues((current) => ({ ...current, paid }))}
            accessibilityLabel={t('income.form.accessibility.received')}
          />
          <ThemedText>{t('income.form.received')}</ThemedText>
        </View>
      )}

      <View style={styles.actionRow}>
        <Button label={submitLabel} onPress={handleSave} disabled={!isValid} style={styles.actionButton} />
        <Button
          label={t('common.cancel')}
          variant="secondary"
          onPress={onCancel}
          disabled={isSaving}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
