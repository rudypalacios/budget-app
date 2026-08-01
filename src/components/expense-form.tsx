import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CurrencyRateField } from '@/components/currency-rate-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';
import type { CurrencyCode, RateSource } from '@/types/firestore';

export type ExpenseFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  isRecurring: boolean;
  dueDay: string;
  // Only meaningful for one-time expenses — recurring instances keep their
  // own unpaid-until-settled lifecycle via the Payments dashboard, and use
  // dueDay (above) instead of a fixed calendar date.
  paid: boolean;
  date: Date | null;
  currency: CurrencyCode;
  // Text, like amount — only meaningful when currency !== defaultCurrency.
  exchangeRateToDefault: string;
  rateSource: RateSource;
};

export type ExpenseFormProps = {
  initialValues?: ExpenseFormValues;
  submitLabel: string;
  onSubmit: (values: ExpenseFormValues) => void | Promise<void>;
  onCancel: () => void;
  // Set on Edit — kind is immutable post-creation (firestore.rules'
  // unchanged('kind')), so an existing one-time expense can never become
  // recurring in place, and vice versa. The toggle is hidden outright
  // rather than shown disabled, so it doesn't look like a control that
  // should do something.
  disableRecurringToggle?: boolean;
  // Set on Edit — a one-time/instance record's own currency+rate are never
  // recalculated once written (data-model.md §8, FR-16; firestore.rules
  // locks both). The picker is hidden outright rather than shown disabled,
  // same convention as disableRecurringToggle above.
  disableCurrencyEdit?: boolean;
  // The app's current default-currency setting — seeds a new record's
  // initial currency selection and drives CurrencyRateField's "does this
  // record need a rate field" comparison. Not meaningful when
  // disableCurrencyEdit is set (the record's own saved currency, carried
  // in initialValues.currency, is what's shown instead).
  defaultCurrency: CurrencyCode;
};

export function ExpenseForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  disableRecurringToggle,
  disableCurrencyEdit,
  defaultCurrency,
}: ExpenseFormProps) {
  const { t } = useTranslation();
  const categories = useCategoriesStore((state) => state.items);
  const expenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );

  const [values, setValues] = useState<ExpenseFormValues>(
    initialValues ?? {
      name: '',
      amount: '',
      categoryId: expenseCategories[0]?.id ?? '',
      isRecurring: false,
      dueDay: '1',
      paid: false,
      date: null,
      currency: defaultCurrency,
      exchangeRateToDefault: '1',
      rateSource: 'manual',
    },
  );

  function handleCurrencyChange(nextCurrency: CurrencyCode) {
    setValues((current) => ({
      ...current,
      currency: nextCurrency,
      exchangeRateToDefault: nextCurrency === defaultCurrency ? '1' : '',
      rateSource: 'manual',
    }));
  }

  const parsedAmount = parseAmountInput(values.amount);
  const parsedRate = parseAmountInput(values.exchangeRateToDefault);
  const isValid =
    !!values.name &&
    !!values.categoryId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (values.isRecurring || values.date !== null) &&
    (disableCurrencyEdit ||
      values.currency === defaultCurrency ||
      (Number.isFinite(parsedRate) && parsedRate > 0));

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
        placeholder={t('expenses.form.namePlaceholder')}
      />
      <TextField
        label={t('common.amountWithCurrency', { currency: values.currency })}
        value={values.amount}
        onChangeText={(amount) => setValues((current) => ({ ...current, amount: sanitizeAmountInput(amount) }))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={t('expenses.form.amountPlaceholder')}
      />

      {!disableCurrencyEdit && (
        <CurrencyRateField
          currency={values.currency}
          onCurrencyChange={handleCurrencyChange}
          defaultCurrency={defaultCurrency}
          rate={values.exchangeRateToDefault}
          onRateChange={(exchangeRateToDefault) =>
            setValues((current) => ({ ...current, exchangeRateToDefault }))
          }
          onRateSourceChange={(rateSource) => setValues((current) => ({ ...current, rateSource }))}
        />
      )}

      <Select
        label={t('common.category')}
        value={values.categoryId}
        options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      {!disableRecurringToggle && (
        <View style={styles.switchRow}>
          <Switch
            value={values.isRecurring}
            onValueChange={(isRecurring) => setValues((current) => ({ ...current, isRecurring }))}
            accessibilityLabel={t('expenses.form.accessibility.recurring')}
          />
          <ThemedText>{t('expenses.form.recurringLabel')}</ThemedText>
        </View>
      )}

      {values.isRecurring && (
        <TextField
          label={t('expenses.form.dueDayOfMonth')}
          value={values.dueDay}
          onChangeText={(dueDay) => setValues((current) => ({ ...current, dueDay }))}
          keyboardType="number-pad"
          editable={!disableRecurringToggle}
        />
      )}

      {!values.isRecurring && (
        <DatePicker
          label={t('expenses.form.dueDate')}
          value={values.date}
          onChange={(date) => setValues((current) => ({ ...current, date }))}
        />
      )}

      {!values.isRecurring && (
        <View style={styles.switchRow}>
          <Switch
            value={values.paid}
            onValueChange={(paid) => setValues((current) => ({ ...current, paid }))}
            accessibilityLabel={t('expenses.form.accessibility.paid')}
          />
          <ThemedText>{t('expenses.form.paid')}</ThemedText>
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
