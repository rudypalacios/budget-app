import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmojiPicker } from '@/components/emoji-picker';
import { SuggestedBudgetRow } from '@/components/suggested-budget-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DiscardChangesSheet } from '@/components/ui/discard-changes-sheet';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { validateCategoryForm, type CategoryFormError } from '@/lib/category-validation';
import type { CurrencyCode } from '@/types/firestore';

const TYPES = ['expense', 'income', 'both'] as const;
const TYPE_LABEL_KEY: Record<(typeof TYPES)[number], string> = {
  expense: 'categories.form.type.expense',
  income: 'categories.form.type.income',
  both: 'categories.form.type.both',
};

const ERROR_KEY: Record<CategoryFormError, string> = {
  nameRequired: 'categories.form.errors.nameRequired',
  duplicateName: 'categories.form.errors.duplicateName',
  negativeBudget: 'categories.form.errors.negativeBudget',
};

export type CategoryFormValues = {
  name: string;
  type: (typeof TYPES)[number];
  // Plain string like the rest of this codebase's amount inputs (see
  // recurring-expense-form.tsx's `amount`) — parsed by the caller on submit.
  monthlyBudget: string;
  // Optional — a category can go without an icon (EmojiPicker's own "None"
  // option), same nullable convention already on Category.icon.
  icon: string | null;
};

export type CategoryFormProps = {
  initialValues?: CategoryFormValues;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
  defaultCurrency: CurrencyCode;
  // Every other category's name, for the duplicate-name check.
  otherNames: readonly string[];
  // D10: what this category costs in a normal month. Offered as a hint with
  // a "Use suggested" button (ajustes-v2 prototype) rather than pre-filled,
  // so an empty budget field always means the user left it empty. null
  // when there's nothing to suggest (e.g. a brand-new category).
  suggestedMonthlyBudget?: number | null;
};

const DEFAULT_VALUES: CategoryFormValues = {
  name: '',
  type: 'expense',
  monthlyBudget: '',
  icon: null,
};

export function CategoryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  defaultCurrency,
  otherNames,
  suggestedMonthlyBudget,
}: CategoryFormProps) {
  const { t } = useTranslation();
  const startingValues = initialValues ?? DEFAULT_VALUES;
  const [values, setValues] = useState<CategoryFormValues>(startingValues);
  const [error, setError] = useState<CategoryFormError | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(startingValues);
  const showSuggestion =
    values.type !== 'income' &&
    suggestedMonthlyBudget != null &&
    suggestedMonthlyBudget > 0 &&
    values.monthlyBudget !== String(suggestedMonthlyBudget);

  function update(patch: Partial<CategoryFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function handleSave() {
    const validationError = validateCategoryForm(values, otherNames);
    if (validationError) {
      setError(validationError);
      return;
    }
    // An income-only category never carries a budget through Save, even if
    // one was typed before switching type to 'income' (the field is hidden
    // below, but local state could still hold a stale value).
    onSubmit(values.type === 'income' ? { ...values, monthlyBudget: '' } : values);
  }

  function handleCancel() {
    if (isDirty) {
      setIsDiscardOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <View style={styles.form}>
      <Card style={styles.card}>
        <TextField
          label={t('common.name')}
          value={values.name}
          onChangeText={(name) => update({ name })}
          placeholder={t('categories.form.namePlaceholder')}
        />

        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('categories.form.appearsIn')}
          </ThemedText>
          <SegmentedControl
            options={TYPES.map((option) => ({ value: option, label: t(TYPE_LABEL_KEY[option]) }))}
            value={values.type}
            onChange={(type) => update({ type })}
          />
        </View>

        {values.type !== 'income' && (
          <View style={styles.field}>
            <TextField
              label={t('categories.form.monthlyBudget', { currency: defaultCurrency })}
              value={values.monthlyBudget}
              onChangeText={(monthlyBudget) => update({ monthlyBudget })}
              placeholder={t('categories.form.monthlyBudgetPlaceholder')}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
            {showSuggestion && (
              <View style={styles.suggestion}>
                <SuggestedBudgetRow
                  suggested={suggestedMonthlyBudget}
                  defaultCurrency={defaultCurrency}
                />
                <Button
                  label={t('budget.setBudgetSheet.useSuggested')}
                  variant="ghost"
                  onPress={() => update({ monthlyBudget: String(suggestedMonthlyBudget) })}
                />
              </View>
            )}
          </View>
        )}

        <EmojiPicker
          label={t('categories.form.icon')}
          value={values.icon}
          onChange={(icon) => update({ icon })}
        />
      </Card>

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {t(ERROR_KEY[error])}
        </ThemedText>
      )}

      <SheetButtons onCancel={handleCancel} confirmLabel={submitLabel} onConfirm={handleSave} />

      <DiscardChangesSheet
        isOpen={isDiscardOpen}
        onKeepEditing={() => setIsDiscardOpen(false)}
        onDiscard={() => {
          setIsDiscardOpen(false);
          onCancel();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  suggestion: {
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
});
