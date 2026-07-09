import { router } from 'expo-router';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addIncome } from '@/store/incomes';

export default function NewIncomeScreen() {
  function handleSubmit(values: IncomeFormValues) {
    addIncome({
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
      <ModalHeader title="Add income" />
      <IncomeForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
