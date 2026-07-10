import { router, useLocalSearchParams } from 'expo-router';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { expensesStore } from '@/lib/mock-stores';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, updateItem } = expensesStore.useStore();
  const expense = items.find((item) => item.id === id);

  if (!expense) {
    return (
      <ScreenScroll>
        <ModalHeader title="Expense not found" />
        <ThemedText>This expense no longer exists.</ThemedText>
      </ScreenScroll>
    );
  }

  const currentDate = expense.date;

  const handleSubmit = (values: ExpenseFormValues) => {
    const date = values.isRecurring
      ? new Date(new Date().getFullYear(), new Date().getMonth(), Number(values.dueDay) || 1)
      : currentDate;

    updateItem(id, {
      name: values.name,
      categoryId: values.categoryId,
      kind: values.isRecurring ? 'recurringInstance' : 'oneTime',
      amount: Number(values.amount),
      date,
    });
    router.back();
  };

  const initialValues: ExpenseFormValues = {
    name: expense.name,
    amount: String(expense.amount),
    categoryId: expense.categoryId,
    isRecurring: expense.kind === 'recurringInstance',
    dueDay: String(expense.date.getDate()),
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
