import { router } from 'expo-router';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addIncome } from '@/store/incomes';
import { generateIncomeInstancesForDefinition } from '@/store/recurring-generation';
import { addRecurringIncome } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';

export default function NewIncomeScreen() {
  const uid = useSessionStore((state) => state.uid);

  async function handleSubmit(values: IncomeFormValues) {
    if (values.isRecurring) {
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
        { id, categoryId, name: values.name, currency, amount, frequency: values.frequency, dayOfMonth, anchorDate: null, startDate },
        new Date(),
      );
    } else {
      addIncome({
        name: values.name,
        categoryId: values.categoryId,
        amount: Number(values.amount),
        currency: 'GTQ',
        date: new Date(),
      });
    }
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add income" />
      <IncomeForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
