import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountCurrencyField } from '@/components/amount-currency-field';
import { RecurringGroupField } from '@/components/recurring-group-field';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { categoryDisplayName } from '@/lib/category-display';
import { parseAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';
import type { CurrencyCode } from '@/types/firestore';

export type RecurringExpenseFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  dueDay: string;
  currency: CurrencyCode;
  recurringGroupId: string | null;
};

export type RecurringExpenseFormProps = {
  initialValues?: RecurringExpenseFormValues;
  submitLabel: string;
  onSubmit: (values: RecurringExpenseFormValues) => void | Promise<void>;
  onCancel: () => void;
  // The app's current default-currency setting — a recurring definition's
  // currency/rate stay genuinely editable here (data-model.md §5: a "live
  // template", re-editable), unlike the one-time/instance forms.
  defaultCurrency: CurrencyCode;
};

export function RecurringExpenseForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  defaultCurrency,
}: RecurringExpenseFormProps) {
  const { t } = useTranslation();
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
      currency: defaultCurrency,
      recurringGroupId: null,
    },
  );

  const parsedAmount = parseAmountInput(values.amount);
  const parsedDueDay = Number(values.dueDay);
  const isValid =
    !!values.name.trim() &&
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

      <AmountCurrencyField
        amount={values.amount}
        onAmountChange={(amount) => setValues((current) => ({ ...current, amount }))}
        amountPlaceholder={t('recurringExpense.form.amountPlaceholder')}
        currency={values.currency}
        onCurrencyChange={(currency) => setValues((current) => ({ ...current, currency }))}
        defaultCurrency={defaultCurrency}
      />

      <Select
        label={t('common.category')}
        value={values.categoryId}
        options={expenseCategories.map((category) => ({ value: category.id, label: categoryDisplayName(category) }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      <TextField
        label={t('recurringExpense.form.dueDayOfMonth')}
        value={values.dueDay}
        onChangeText={(dueDay) => setValues((current) => ({ ...current, dueDay }))}
        keyboardType="number-pad"
      />

      <RecurringGroupField
        value={values.recurringGroupId}
        onChange={(recurringGroupId) => setValues((current) => ({ ...current, recurringGroupId }))}
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
