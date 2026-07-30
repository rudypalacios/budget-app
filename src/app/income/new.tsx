import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { parseAmountInput } from '@/lib/currency-input';
import { addIncome } from '@/store/incomes';
import { generateIncomeInstancesForDefinition } from '@/store/recurring-generation';
import { addRecurringIncome } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { useUserSettingsStore } from '@/store/user-settings';

export default function NewIncomeScreen() {
  const { t } = useTranslation();
  const uid = useSessionStore((state) => state.uid);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  async function handleSubmit(values: IncomeFormValues) {
    if (values.isRecurring) {
      if (!uid) return;
      const startDate = new Date();
      const categoryId = values.categoryId;
      const currency = defaultCurrency;
      const amount = parseAmountInput(values.amount);
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
        amount: parseAmountInput(values.amount),
        currency: defaultCurrency,
        // isValid requires values.date to be set on the one-time branch —
        // the fallback here only guards the type, it's never actually hit.
        date: values.date ?? new Date(),
        paid: values.paid,
      });
    }
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title={t('income.addTitle')} />
      <IncomeForm
        currency={defaultCurrency}
        submitLabel={t('common.save')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
