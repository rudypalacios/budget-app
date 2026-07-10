import { router } from 'expo-router';

import { ModalHeader } from '@/components/modal-header';
import { RecurringIncomeForm, type RecurringIncomeFormValues } from '@/components/recurring-income-form';
import { ScreenScroll } from '@/components/screen-scroll';
import { addRecurringIncome } from '@/store/recurring-incomes';
import { generateIncomeInstancesForDefinition } from '@/store/recurring-generation';
import { useSessionStore } from '@/store/session';

export default function NewRecurringIncomeScreen() {
  const uid = useSessionStore((state) => state.uid);

  async function handleSubmit(values: RecurringIncomeFormValues) {
    if (!uid) return;

    const startDate = new Date();
    const categoryId = values.categoryId;
    const currency = 'GTQ';
    const amount = Number(values.amount);
    const dayOfMonth = values.frequency === 'monthly' ? Number(values.dayOfMonth) : null;

    const id = await addRecurringIncome({
      name: values.name,
      categoryId,
      amount,
      currency,
      startDate,
      frequency: values.frequency,
      dayOfMonth,
      anchorDate: null, // defaults to startDate — see recurring-income-form.tsx
    });

    // Generate this period's instance immediately rather than waiting for
    // the next app launch's catch-up scan (src/app/_layout.tsx).
    await generateIncomeInstancesForDefinition(
      uid,
      {
        id,
        categoryId,
        name: values.name,
        currency,
        amount,
        frequency: values.frequency,
        dayOfMonth,
        anchorDate: null,
        startDate,
      },
      new Date(),
    );

    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add recurring income" />
      <RecurringIncomeForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
