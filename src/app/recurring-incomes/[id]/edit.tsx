import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/modal-header';
import { RecurringIncomeForm, type RecurringIncomeFormValues } from '@/components/recurring-income-form';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { parseAmountInput } from '@/lib/currency-input';
import { updateRecurringIncome, useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useUserSettingsStore } from '@/store/user-settings';

export default function EditRecurringIncomeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useRecurringIncomesStore((state) => state.items);
  const definition = items.find((item) => item.id === id);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  if (!definition) {
    return (
      <ScreenScroll>
        <ModalHeader title={t('recurringIncome.notFoundTitle')} />
        <ThemedText>{t('recurringIncome.notFoundBody')}</ThemedText>
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
      amount: parseAmountInput(values.amount),
      frequency: values.frequency,
      dayOfMonth: values.frequency === 'monthly' ? Number(values.dayOfMonth) : null,
      currency: values.currency,
      exchangeRateToDefault:
        values.currency === defaultCurrency ? 1 : parseAmountInput(values.exchangeRateToDefault),
    });
    router.back();
  }

  const initialValues: RecurringIncomeFormValues = {
    name: definition.name,
    amount: String(definition.amount),
    categoryId: definition.categoryId,
    frequency: definition.frequency,
    dayOfMonth: String(definition.dayOfMonth ?? 1),
    currency: definition.currency,
    exchangeRateToDefault: String(definition.exchangeRateToDefault),
  };

  return (
    <ScreenScroll>
      <ModalHeader title={t('recurringIncome.editTitle')} />
      <RecurringIncomeForm
        initialValues={initialValues}
        defaultCurrency={defaultCurrency}
        submitLabel={t('common.saveChanges')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
