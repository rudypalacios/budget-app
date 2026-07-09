import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCategoriesStore } from '@/store/categories';

const FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const;

export type IncomeFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  isRecurring: boolean;
  frequency: (typeof FREQUENCIES)[number];
};

export type IncomeFormProps = {
  initialValues?: IncomeFormValues;
  submitLabel: string;
  onSubmit: (values: IncomeFormValues) => void;
  onCancel: () => void;
};

export function IncomeForm({ initialValues, submitLabel, onSubmit, onCancel }: IncomeFormProps) {
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
        placeholder="e.g. Salary"
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
        options={incomeCategories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={(categoryId) => setValues((current) => ({ ...current, categoryId }))}
      />

      {/* Inert until recurringIncomes definitions + generation exist (a
          later stage) — see CLAUDE.md Known Issues. Every submit currently
          writes kind: 'oneTime' regardless of this toggle. */}
      <View style={styles.switchRow}>
        <Switch
          value={values.isRecurring}
          onValueChange={(isRecurring) => setValues((current) => ({ ...current, isRecurring }))}
          accessibilityLabel="Recurring income"
        />
        <ThemedText>Recurring</ThemedText>
      </View>

      {values.isRecurring && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Frequency
          </ThemedText>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setValues((current) => ({ ...current, frequency: option }))}
              >
                <Chip label={option} tone={values.frequency === option ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </>
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
