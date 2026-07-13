import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { addExpense } from '@/store/expenses';
import { useCategoriesStore } from '@/store/categories';

// A fast path for logging something already spent, right from the Payments
// dashboard — no recurring option (that's the Expenses tab's job, see
// CLAUDE.md's Expenses/Income vs. Payments division of responsibility).
// addExpense() saves one-time expenses as paid immediately.
export default function QuickExpenseScreen() {
  const categories = useCategoriesStore((state) => state.items);
  const expenseCategories = categories.filter(
    (category) => category.lifecycleState === 'active' && (category.type === 'expense' || category.type === 'both'),
  );

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');

  const parsedAmount = Number(amount);
  const isValid = !!name && !!categoryId && Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function handleSave() {
    addExpense({ name, categoryId, amount: parsedAmount, currency: 'GTQ', date: new Date() });
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
