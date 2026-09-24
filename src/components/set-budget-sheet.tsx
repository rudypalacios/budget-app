import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { getCurrencySymbol } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { suggestCategoryMonthlyBudget } from '@/lib/budget-recommendation';
import { normalizeMonthlyBudget } from '@/lib/budget-status';
import { categoryDisplayName } from '@/lib/category-display';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import { updateCategory } from '@/store/categories';
import { showToast } from '@/store/toast';
import type { Category, CurrencyCode, RecurringExpense } from '@/types/firestore';

export type SetBudgetSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  category: WithId<Category>;
  recurringExpensesInCategory: WithId<RecurringExpense>[];
  defaultCurrency: CurrencyCode;
};

// Presupuesto redesign fase 6: the Budget screen can only *set* a monthly
// budget on a category that has none. Changing or removing an existing one
// stays in Settings → Categories, by product decision (spec §1).
export function SetBudgetSheet({ isOpen, onClose, ...formProps }: SetBudgetSheetProps) {
  const { t } = useTranslation();

  // The form only mounts while open, so every opening starts with an empty
  // field and no leftover error.
  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title={t('budget.setBudgetSheet.title')}>
      {isOpen && <SetBudgetForm onClose={onClose} {...formProps} />}
    </ActionSheet>
  );
}

function SetBudgetForm({
  onClose,
  category,
  recurringExpensesInCategory,
  defaultCurrency,
}: Omit<SetBudgetSheetProps, 'isOpen'>) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const suggested = suggestCategoryMonthlyBudget(category.id, recurringExpensesInCategory, defaultCurrency);
  const hasSuggestion = suggested !== null && suggested > 0;

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
      t('budget.setBudgetSheet.saved', { name: categoryDisplayName(category), amount: formatCurrency(amount, defaultCurrency) }),
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

      {hasSuggestion && (
        <View style={styles.suggestion}>
          <ThemedText type="caption">
            {t('budget.setBudgetSheet.suggestion', { amount: formatCurrency(suggested, defaultCurrency) })}
          </ThemedText>
          <Button
            label={t('budget.setBudgetSheet.useSuggested')}
            variant="ghost"
            onPress={() => {
              setValue(String(Math.round(suggested * 100) / 100));
              setError(undefined);
            }}
          />
        </View>
      )}

      <View style={styles.buttons}>
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} style={styles.button} />
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
