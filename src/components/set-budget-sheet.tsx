import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { getCurrencySymbol } from '@/constants/currencies';
import { SuggestedBudgetRow } from '@/components/suggested-budget-row';
import { Spacing } from '@/constants/theme';
import { normalizeMonthlyBudget } from '@/lib/budget-status';
import { categoryDisplayName } from '@/lib/category-display';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import { updateCategory } from '@/store/categories';
import { showToast } from '@/store/toast';
import type { Category, CurrencyCode } from '@/types/firestore';

export type SetBudgetSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  category: WithId<Category>;
  defaultCurrency: CurrencyCode;
  // D10: suggestCategoryBudget's value for this category, or null (no row).
  suggested: number | null;
};

// Presupuesto redesign fase 6 + D13: sets a monthly budget on a category
// that has none, or adjusts an existing one (same sheet, prefilled with the
// current value). Removing a budget still lives in Settings → Categories.
export function SetBudgetSheet({ isOpen, onClose, ...formProps }: SetBudgetSheetProps) {
  const { t } = useTranslation();
  const isAdjusting = normalizeMonthlyBudget(formProps.category.monthlyBudget) !== null;

  // The form only mounts while open, so every opening starts from the
  // current value (or empty) with no leftover error.
  return (
    <ActionSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t(isAdjusting ? 'budget.setBudgetSheet.adjustTitle' : 'budget.setBudgetSheet.title')}
    >
      {isOpen && <SetBudgetForm onClose={onClose} {...formProps} />}
    </ActionSheet>
  );
}

function SetBudgetForm({
  onClose,
  category,
  defaultCurrency,
  suggested,
}: Omit<SetBudgetSheetProps, 'isOpen'>) {
  const { t } = useTranslation();
  const current = normalizeMonthlyBudget(category.monthlyBudget);
  const [value, setValue] = useState(current === null ? '' : String(current));
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSave() {
    // Same rule as the category forms (D1): anything that isn't > 0 is not
    // a budget, so it's rejected here instead of silently saved as "none".
    const amount = normalizeMonthlyBudget(parseAmountInput(value));
    if (amount === null) {
      setError(t('budget.setBudgetSheet.error'));
      return;
    }
    // Not awaited, same as the category edit screen: Firestore resolves the
    // write only on server ack, which never comes offline — the local cache
    // already has the new budget, so the card moves to the budgeted list now.
    // A real rejection (e.g. permission-denied) still gets surfaced, since
    // the success toast below has already been shown by then.
    updateCategory(category.id, { monthlyBudget: amount }).catch(() => {
      showToast(t('budget.setBudgetSheet.saveFailed'));
    });
    onClose();
    showToast(
      t(current === null ? 'budget.setBudgetSheet.saved' : 'budget.setBudgetSheet.updated', {
        name: categoryDisplayName(category),
        amount: formatCurrency(amount, defaultCurrency),
      }),
    );
  }

  return (
    <>
      <TextField
        label={t('budget.setBudgetSheet.field', { currency: getCurrencySymbol(defaultCurrency) })}
        value={value}
        onChangeText={(text) => {
          setValue(sanitizeAmountInput(text));
          setError(undefined);
        }}
        keyboardType="decimal-pad"
        autoFocus
        error={error}
      />

      {suggested !== null && (
        <View style={styles.suggestion}>
          <SuggestedBudgetRow suggested={suggested} defaultCurrency={defaultCurrency} />
          <Button
            label={t('budget.setBudgetSheet.useSuggested')}
            variant="ghost"
            onPress={() => {
              setValue(String(suggested));
              setError(undefined);
            }}
          />
        </View>
      )}

      <View style={styles.buttons}>
        <Button
          label={t('common.cancel')}
          variant="secondary"
          onPress={onClose}
          style={styles.button}
        />
        <Button label={t('common.save')} onPress={handleSave} style={styles.button} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  suggestion: {
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
