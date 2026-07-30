import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/modal-header';
import {
  RecurringExpenseForm,
  type RecurringExpenseFormValues,
} from '@/components/recurring-expense-form';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { parseAmountInput } from '@/lib/currency-input';
import { updateRecurringExpense, useRecurringExpensesStore } from '@/store/recurring-expenses';

export default function EditRecurringExpenseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useRecurringExpensesStore((state) => state.items);
  const definition = items.find((item) => item.id === id);

  if (!definition) {
    return (
      <ScreenScroll>
        <ModalHeader title={t('recurringExpense.notFoundTitle')} />
        <ThemedText>{t('recurringExpense.notFoundBody')}</ThemedText>
      </ScreenScroll>
    );
  }

  function handleSubmit(values: RecurringExpenseFormValues) {
    // Per data-model.md §5: editing amount/dueDay/currency here only takes
    // effect starting with the next generation cycle — already-generated
    // instances keep their own budgetedAmount/budgetedCurrency snapshot.
    updateRecurringExpense(id, {
      name: values.name,
      categoryId: values.categoryId,
      amount: parseAmountInput(values.amount),
      dueDay: Number(values.dueDay),
    });
    router.back();
  }

  const initialValues: RecurringExpenseFormValues = {
    name: definition.name,
    amount: String(definition.amount),
    categoryId: definition.categoryId,
    dueDay: String(definition.dueDay),
  };

  return (
    <ScreenScroll>
      <ModalHeader title={t('recurringExpense.editTitle')} />
      <RecurringExpenseForm
        initialValues={initialValues}
        currency={definition.currency}
        submitLabel={t('common.saveChanges')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
