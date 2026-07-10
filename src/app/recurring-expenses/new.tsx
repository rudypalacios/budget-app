import { router } from 'expo-router';

import { ModalHeader } from '@/components/modal-header';
import {
  RecurringExpenseForm,
  type RecurringExpenseFormValues,
} from '@/components/recurring-expense-form';
import { ScreenScroll } from '@/components/screen-scroll';
import { addRecurringExpense } from '@/store/recurring-expenses';
import { generateExpenseInstancesForDefinition } from '@/store/recurring-generation';
import { useSessionStore } from '@/store/session';

export default function NewRecurringExpenseScreen() {
  const uid = useSessionStore((state) => state.uid);

  async function handleSubmit(values: RecurringExpenseFormValues) {
    if (!uid) return;

    const startDate = new Date();
    const categoryId = values.categoryId;
    const currency = 'GTQ';
    const amount = Number(values.amount);
    const dueDay = Number(values.dueDay);

    const id = await addRecurringExpense({
      name: values.name,
      categoryId,
      amount,
      currency,
      dueDay,
      startDate,
    });

    // Generate this period's instance immediately rather than waiting for
    // the next app launch's catch-up scan (src/app/_layout.tsx).
    await generateExpenseInstancesForDefinition(
      uid,
      { id, categoryId, name: values.name, currency, amount, dueDay, startDate },
      new Date(),
    );

    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add recurring expense" />
      <RecurringExpenseForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
