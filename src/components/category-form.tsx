import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import type { CurrencyCode } from '@/types/firestore';

const TYPES = ['expense', 'income', 'both'] as const;
const TYPE_LABEL_KEY: Record<(typeof TYPES)[number], string> = {
  expense: 'categories.form.type.expense',
  income: 'categories.form.type.income',
  both: 'categories.form.type.both',
};

export type CategoryFormValues = {
  name: string;
  type: (typeof TYPES)[number];
  // Plain string like the rest of this codebase's amount inputs (see
  // recurring-expense-form.tsx's `amount`) — parsed by the caller on submit.
  monthlyBudget: string;
};

export type CategoryFormProps = {
  initialValues?: CategoryFormValues;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  onCancel: () => void;
  defaultCurrency: CurrencyCode;
  // Stage 13: sum of this category's active recurring-expense amounts, in
  // defaultCurrency — pre-fills monthlyBudget when it's unset (a starting
  // suggestion, not a live derivation; the field stays freely editable).
  // null when there's no suggestion to offer (e.g. a brand-new category).
  suggestedMonthlyBudget?: number | null;
};

const DEFAULT_VALUES: CategoryFormValues = {
  name: '',
  type: 'expense',
  monthlyBudget: '',
};

export function CategoryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  defaultCurrency,
  suggestedMonthlyBudget,
}: CategoryFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<CategoryFormValues>(() => {
    const base = initialValues ?? DEFAULT_VALUES;
    if (base.monthlyBudget === '' && suggestedMonthlyBudget != null) {
      return { ...base, monthlyBudget: String(suggestedMonthlyBudget) };
    }
    return base;
  });

  const isValid = !!values.name;

  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      // An income-only category never carries a budget through Save, even if
      // one was typed before switching type to 'income' (the field is hidden
      // below, but local state could still hold a stale value).
      await onSubmit(values.type === 'income' ? { ...values, monthlyBudget: '' } : values);
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
        placeholder={t('categories.form.namePlaceholder')}
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('categories.form.appearsIn')}
      </ThemedText>
      <View style={styles.chipRow}>
        {TYPES.map((option) => (
          <Pressable key={option} onPress={() => setValues((current) => ({ ...current, type: option }))}>
            <Chip label={t(TYPE_LABEL_KEY[option])} tone={values.type === option ? 'success' : 'neutral'} />
          </Pressable>
        ))}
      </View>

      {values.type !== 'income' && (
        <TextField
          label={t('categories.form.monthlyBudget', { currency: defaultCurrency })}
          value={values.monthlyBudget}
          onChangeText={(monthlyBudget) => setValues((current) => ({ ...current, monthlyBudget }))}
          placeholder={t('categories.form.monthlyBudgetPlaceholder')}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
