import { router } from 'expo-router';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addExpense } from '@/store/expenses';

export default function NewExpenseScreen() {
  function handleSubmit(values: ExpenseFormValues) {
    addExpense({
      name: values.name,
      categoryId: values.categoryId,
      amount: Number(values.amount),
      currency: 'GTQ',
      date: new Date(),
    });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add expense" />
      <ExpenseForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
