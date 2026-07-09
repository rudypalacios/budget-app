import { router, useLocalSearchParams } from 'expo-router';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { updateExpense, useExpensesStore } from '@/store/expenses';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useExpensesStore((state) => state.items);
  const expense = items.find((item) => item.id === id);

  if (!expense) {
    return (
      <ScreenScroll>
        <ModalHeader title="Expense not found" />
        <ThemedText>This expense no longer exists.</ThemedText>
      </ScreenScroll>
    );
  }

  const handleSubmit = (values: ExpenseFormValues) => {
    updateExpense(id, {
      name: values.name,
      categoryId: values.categoryId,
      amount: Number(values.amount),
    });
    router.back();
  };

  const initialValues: ExpenseFormValues = {
    name: expense.name,
    amount: String(expense.amount ?? 0),
    categoryId: expense.categoryId,
    isRecurring: expense.kind === 'recurringInstance',
    dueDay: String(expense.date.toDate().getDate()),
  };

  return (
    <ScreenScroll>
      <ModalHeader title="Edit expense" />
      <ExpenseForm
        initialValues={initialValues}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
