import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { useCategoriesStore } from '@/store/categories';

const FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const;

export type RecurringIncomeFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  frequency: (typeof FREQUENCIES)[number];
  dayOfMonth: string;
};

export type RecurringIncomeFormProps = {
  initialValues?: RecurringIncomeFormValues;
  submitLabel: string;
  onSubmit: (values: RecurringIncomeFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function RecurringIncomeForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: RecurringIncomeFormProps) {
  const categories = useCategoriesStore((state) => state.items);
  const incomeCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'income' || category.type === 'both'),
  );

  const [values, setValues] = useState<RecurringIncomeFormValues>(
    initialValues ?? {
      name: '',
      amount: '',
      categoryId: incomeCategories[0]?.id ?? '',
      frequency: 'monthly',
      dayOfMonth: '1',
    },
  );

  const parsedAmount = parseAmountInput(values.amount);
  const parsedDayOfMonth = Number(values.dayOfMonth);
  const isValid =
    !!values.name &&
    !!values.categoryId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (values.frequency !== 'monthly' ||
      (Number.isInteger(parsedDayOfMonth) && parsedDayOfMonth >= 1 && parsedDayOfMonth <= 31));

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
        label="Name"
        value={values.name}
        onChangeText={(name) => setValues((current) => ({ ...current, name }))}
        placeholder="e.g. Salary"
      />
      <TextField
        label="Amount (GTQ)"
        value={values.amount}
        onChangeText={(amount) => setValues((current) => ({ ...current, amount: sanitizeAmountInput(amount) }))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0.00"
      />

      <Select
        label="Category"
        value={values.categoryId}
        options={incomeCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        Frequency
      </ThemedText>
      <View style={styles.chipRow}>
        {FREQUENCIES.map((option) => (
          <Pressable key={option} onPress={() => setValues((current) => ({ ...current, frequency: option }))}>
            <Chip label={option} tone={values.frequency === option ? 'success' : 'neutral'} />
          </Pressable>
        ))}
      </View>

      {/* anchorDate (weekly/biweekly) isn't exposed as a field — it defaults
          to the creation date, same as startDate. Unlike a one-time due
          date, a recurring definition's start point isn't user-facing data
          worth editing after the fact. */}
      {values.frequency === 'monthly' && (
        <TextField
          label="Day of month"
          value={values.dayOfMonth}
          onChangeText={(dayOfMonth) => setValues((current) => ({ ...current, dayOfMonth }))}
          keyboardType="number-pad"
        />
      )}

      <View style={styles.actionRow}>
        <Button label={submitLabel} onPress={handleSave} disabled={!isValid} style={styles.actionButton} />
        <Button
          label="Cancel"
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
