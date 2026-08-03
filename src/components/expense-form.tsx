import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountCurrencyField } from '@/components/amount-currency-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';
import type { CurrencyCode } from '@/types/firestore';

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
  // locks both). The currency picker is hidden outright rather than shown
  // disabled, same convention as disableRecurringToggle above — Edit falls
  // back to a plain amount field with the record's own currency baked into
  // its label, since AmountCurrencyField's picker is only for the still-
  // editable case.
  disableCurrencyEdit?: boolean;
  // The app's current default-currency setting — seeds a new record's
  // initial currency selection. Not meaningful when disableCurrencyEdit is
  // set (the record's own saved currency, carried in initialValues.currency,
  // is what's shown instead).
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
        placeholder={t('expenses.form.namePlaceholder')}
      />

      {disableCurrencyEdit ? (
        <TextField
          label={t('common.amountWithCurrency', { currency: values.currency })}
          value={values.amount}
          onChangeText={(amount) => setValues((current) => ({ ...current, amount: sanitizeAmountInput(amount) }))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={t('expenses.form.amountPlaceholder')}
        />
      ) : (
        <AmountCurrencyField
          amount={values.amount}
          onAmountChange={(amount) => setValues((current) => ({ ...current, amount }))}
          amountPlaceholder={t('expenses.form.amountPlaceholder')}
          currency={values.currency}
          onCurrencyChange={(currency) => setValues((current) => ({ ...current, currency }))}
          defaultCurrency={defaultCurrency}
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

      {/* Only relevant when creating a brand-new recurring definition —
          disableRecurringToggle is only ever passed on Edit, where
          values.isRecurring is forced true for an already-generated
          instance. Editing an instance's dueDay here would be dead UI: it's
          never included in the edit screens' onSubmit payload, since a
          single occurrence can't change its own template's schedule. */}
      {values.isRecurring && !disableRecurringToggle && (
        <TextField
          label={t('expenses.form.dueDayOfMonth')}
          value={values.dueDay}
          onChangeText={(dueDay) => setValues((current) => ({ ...current, dueDay }))}
          keyboardType="number-pad"
        />
      )}

      {!values.isRecurring && (
        <DatePicker
          label={t('expenses.form.date')}
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
