import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { addExpense } from '@/store/expenses';
import { useCategoriesStore } from '@/store/categories';
import { useUserSettingsStore } from '@/store/user-settings';

// A fast path for logging something already spent, right from the Payments
// dashboard — no recurring option (that's the Expenses tab's job, see
// CLAUDE.md's Expenses/Income vs. Payments division of responsibility).
// Paid defaults on here (unlike the full Expenses form), since this shortcut
// exists specifically for something already spent — but it's still an
// editable switch, not hardcoded, in case the user is quick-logging a
// planned purchase instead.
export default function QuickExpenseScreen() {
  const { t } = useTranslation();
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const categories = useCategoriesStore((state) => state.items);
  const expenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [paid, setPaid] = useState(true);

  const parsedAmount = parseAmountInput(amount);
  const isValid = !!name && !!categoryId && Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function handleSave() {
    addExpense({ name, categoryId, amount: parsedAmount, currency: defaultCurrency, date: new Date(), paid });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title={t('quickExpense.title')} />
      <View style={styles.form}>
        <TextField
          label={t('common.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('quickExpense.namePlaceholder')}
        />
        <TextField
          label={t('common.amountWithCurrency', { currency: defaultCurrency })}
          value={amount}
          onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={t('quickExpense.amountPlaceholder')}
        />
        <Select
          label={t('common.category')}
          value={categoryId}
          options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={setCategoryId}
        />
        <View style={styles.switchRow}>
          <Switch value={paid} onValueChange={setPaid} accessibilityLabel={t('quickExpense.paid')} />
          <ThemedText>{t('quickExpense.paid')}</ThemedText>
        </View>
        <View style={styles.actionRow}>
          <Button label={t('common.save')} onPress={handleSave} disabled={!isValid} style={styles.actionButton} />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => router.back()}
            style={styles.actionButton}
          />
        </View>
      </View>
    </ScreenScroll>
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
