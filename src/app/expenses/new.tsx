import { router } from 'expo-router';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { expensesStore } from '@/lib/mock-stores';

export default function NewExpenseScreen() {
  const { addItem } = expensesStore.useStore();

  function handleSubmit(values: ExpenseFormValues) {
    const date = values.isRecurring
      ? new Date(new Date().getFullYear(), new Date().getMonth(), Number(values.dueDay) || 1)
      : new Date();

    addItem({
      id: `exp-${Date.now()}`,
      name: values.name,
      categoryId: values.categoryId,
      kind: values.isRecurring ? 'recurringInstance' : 'oneTime',
      amount: Number(values.amount),
      currency: 'GTQ',
      date,
      paid: false,
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
