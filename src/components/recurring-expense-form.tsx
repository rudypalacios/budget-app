import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';
import { useUserSettingsStore } from '@/store/user-settings';

export type RecurringExpenseFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  dueDay: string;
};

export type RecurringExpenseFormProps = {
  initialValues?: RecurringExpenseFormValues;
  submitLabel: string;
  onSubmit: (values: RecurringExpenseFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function RecurringExpenseForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: RecurringExpenseFormProps) {
  const { t } = useTranslation();
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const categories = useCategoriesStore((state) => state.items);
  const expenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );

  const [values, setValues] = useState<RecurringExpenseFormValues>(
    initialValues ?? {
      name: '',
      amount: '',
      categoryId: expenseCategories[0]?.id ?? '',
      dueDay: '1',
    },
  );

  const parsedAmount = parseAmountInput(values.amount);
  const parsedDueDay = Number(values.dueDay);
  const isValid =
    !!values.name &&
    !!values.categoryId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    Number.isInteger(parsedDueDay) &&
    parsedDueDay >= 1 &&
    parsedDueDay <= 31;

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
        placeholder={t('recurringExpense.form.namePlaceholder')}
      />
      <TextField
        label={t('common.amountWithCurrency', { currency: defaultCurrency })}
        value={values.amount}
        onChangeText={(amount) => setValues((current) => ({ ...current, amount: sanitizeAmountInput(amount) }))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={t('recurringExpense.form.amountPlaceholder')}
      />

      <Select
        label={t('common.category')}
        value={values.categoryId}
        options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      <TextField
        label={t('recurringExpense.form.dueDayOfMonth')}
        value={values.dueDay}
        onChangeText={(dueDay) => setValues((current) => ({ ...current, dueDay }))}
        keyboardType="number-pad"
      />

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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
