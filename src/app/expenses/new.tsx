import { router } from 'expo-router';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addExpense } from '@/store/expenses';
import { addRecurringExpense } from '@/store/recurring-expenses';
import { generateExpenseInstancesForDefinition } from '@/store/recurring-generation';
import { useSessionStore } from '@/store/session';

export default function NewExpenseScreen() {
  const uid = useSessionStore((state) => state.uid);

  async function handleSubmit(values: ExpenseFormValues) {
    if (values.isRecurring) {
      if (!uid) return;
      const startDate = new Date();
      const categoryId = values.categoryId;
      const currency = 'GTQ';
      const amount = Number(values.amount);
      const dueDay = Number(values.dueDay);

      const id = await addRecurringExpense({ name: values.name, categoryId, amount, currency, dueDay, startDate });
      // Generate this period's instance immediately rather than waiting for
      // the next app launch's catch-up scan (src/app/_layout.tsx).
      await generateExpenseInstancesForDefinition(
        uid,
        { id, categoryId, name: values.name, currency, amount, dueDay, startDate },
        new Date(),
      );
    } else {
      addExpense({
        name: values.name,
        categoryId: values.categoryId,
        amount: Number(values.amount),
        currency: 'GTQ',
        date: new Date(),
        paid: values.paid,
      });
    }
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add expense" />
      <ExpenseForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
