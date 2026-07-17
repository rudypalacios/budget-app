import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { addExpense } from '@/store/expenses';
import { useCategoriesStore } from '@/store/categories';

// A fast path for logging something already spent, right from the Payments
// dashboard — no recurring option (that's the Expenses tab's job, see
// CLAUDE.md's Expenses/Income vs. Payments division of responsibility).
// Paid defaults on here (unlike the full Expenses form), since this shortcut
// exists specifically for something already spent — but it's still an
// editable switch, not hardcoded, in case the user is quick-logging a
// planned purchase instead.
export default function QuickExpenseScreen() {
  const categories = useCategoriesStore((state) => state.items);
  const expenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [paid, setPaid] = useState(true);

  const parsedAmount = Number(amount);
  const isValid = !!name && !!categoryId && Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function handleSave() {
    addExpense({ name, categoryId, amount: parsedAmount, currency: 'GTQ', date: new Date(), paid });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Quick expense" />
      <View style={styles.form}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Coffee" />
        <TextField
          label="Amount (GTQ)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Select
          label="Category"
          value={categoryId}
          options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={setCategoryId}
        />
        <View style={styles.switchRow}>
          <Switch value={paid} onValueChange={setPaid} accessibilityLabel="Paid" />
          <ThemedText>Paid</ThemedText>
        </View>
        <View style={styles.actionRow}>
          <Button label="Save" onPress={handleSave} disabled={!isValid} style={styles.actionButton} />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={styles.actionButton} />
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
