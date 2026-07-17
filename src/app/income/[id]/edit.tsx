import { router, useLocalSearchParams } from 'expo-router';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { parseAmountInput } from '@/lib/currency-input';
import { setIncomeReceived, toTimestamp, updateIncome, useIncomesStore } from '@/store/incomes';

export default function EditIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useIncomesStore((state) => state.items);
  const income = items.find((item) => item.id === id);

  if (!income) {
    return (
      <ScreenScroll>
        <ModalHeader title="Income not found" />
        <ThemedText>This income record no longer exists.</ThemedText>
      </ScreenScroll>
    );
  }

  const handleSubmit = (values: IncomeFormValues) => {
    updateIncome(id, {
      name: values.name,
      categoryId: values.categoryId,
      amount: parseAmountInput(values.amount),
      // Only meaningful for a one-time income (the only case the form
      // exposes this field for) — values.date is guaranteed non-null there.
      date: toTimestamp(values.date ?? income.date.toDate()),
    });
    if (values.paid !== income.paid) {
      setIncomeReceived(id, values.paid);
    }
    router.back();
  };

  const initialValues: IncomeFormValues = {
    name: income.name,
    amount: String(income.amount),
    categoryId: income.categoryId,
    isRecurring: income.kind === 'recurringInstance',
    frequency: 'monthly',
    dayOfMonth: '1',
    paid: income.paid,
    date: income.date.toDate(),
  };

  return (
    <ScreenScroll>
      <ModalHeader title="Edit income" />
      <IncomeForm
        initialValues={initialValues}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        disableRecurringToggle
      />
    </ScreenScroll>
  );
}
