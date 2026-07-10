import { router, useLocalSearchParams } from 'expo-router';

import { ModalHeader } from '@/components/modal-header';
import { RecurringIncomeForm, type RecurringIncomeFormValues } from '@/components/recurring-income-form';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { updateRecurringIncome, useRecurringIncomesStore } from '@/store/recurring-incomes';

export default function EditRecurringIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useRecurringIncomesStore((state) => state.items);
  const definition = items.find((item) => item.id === id);

  if (!definition) {
    return (
      <ScreenScroll>
        <ModalHeader title="Recurring income not found" />
        <ThemedText>This recurring income no longer exists.</ThemedText>
      </ScreenScroll>
    );
  }

  function handleSubmit(values: RecurringIncomeFormValues) {
    // Per data-model.md §5: editing amount/frequency/dayOfMonth here only
    // takes effect starting with the next generation cycle —
    // already-generated instances are untouched.
    updateRecurringIncome(id, {
      name: values.name,
      categoryId: values.categoryId,
      amount: Number(values.amount),
      frequency: values.frequency,
      dayOfMonth: values.frequency === 'monthly' ? Number(values.dayOfMonth) : null,
    });
    router.back();
  }

  const initialValues: RecurringIncomeFormValues = {
    name: definition.name,
    amount: String(definition.amount),
    categoryId: definition.categoryId,
    frequency: definition.frequency,
    dayOfMonth: String(definition.dayOfMonth ?? 1),
  };

  return (
    <ScreenScroll>
      <ModalHeader title="Edit recurring income" />
      <RecurringIncomeForm
        initialValues={initialValues}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
