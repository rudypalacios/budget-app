import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { categoriesStore } from '@/lib/mock-stores';

export type ExpenseFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  isRecurring: boolean;
  dueDay: string;
};

export type ExpenseFormProps = {
  initialValues?: ExpenseFormValues;
  submitLabel: string;
  onSubmit: (values: ExpenseFormValues) => void;
  onCancel: () => void;
};

export function ExpenseForm({ initialValues, submitLabel, onSubmit, onCancel }: ExpenseFormProps) {
  const { items: categories } = categoriesStore.useStore();
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
    },
  );

  const parsedAmount = Number(values.amount);
  const isValid = !!values.name && !!values.categoryId && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        value={values.name}
        onChangeText={(name) => setValues((current) => ({ ...current, name }))}
        placeholder="e.g. Groceries"
      />
      <TextField
        label="Amount (GTQ)"
        value={values.amount}
        onChangeText={(amount) => setValues((current) => ({ ...current, amount }))}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />

      <Select
        label="Category"
        value={values.categoryId}
        options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      <View style={styles.switchRow}>
        <Switch
          value={values.isRecurring}
          onValueChange={(isRecurring) => setValues((current) => ({ ...current, isRecurring }))}
          accessibilityLabel="Recurring expense"
        />
        <ThemedText>Recurring monthly</ThemedText>
      </View>

      {values.isRecurring && (
        <TextField
          label="Due day of month"
          value={values.dueDay}
          onChangeText={(dueDay) => setValues((current) => ({ ...current, dueDay }))}
          keyboardType="number-pad"
        />
      )}

      <View style={styles.actionRow}>
        <Button label={submitLabel} onPress={() => onSubmit(values)} disabled={!isValid} style={styles.actionButton} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.actionButton} />
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
