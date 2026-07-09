import { router } from 'expo-router';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { incomesStore } from '@/lib/mock-stores';

export default function NewIncomeScreen() {
  const { addItem } = incomesStore.useStore();

  function handleSubmit(values: IncomeFormValues) {
    addItem({
      id: `inc-${Date.now()}`,
      name: values.name,
      categoryId: values.categoryId,
      kind: values.isRecurring ? 'recurringInstance' : 'oneTime',
      amount: Number(values.amount),
      currency: 'GTQ',
      date: new Date(),
      paid: false,
    });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add income" />
      <IncomeForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
