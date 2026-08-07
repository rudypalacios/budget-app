import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IncomeForm, type IncomeFormValues } from '@/components/income-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { parseAmountInput } from '@/lib/currency-input';
import { getConfiguredRate } from '@/store/currencies';
import { addIncome } from '@/store/incomes';
import { generateIncomeInstancesForDefinition } from '@/store/recurring-generation';
import { addRecurringIncome } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { useUserSettingsStore } from '@/store/user-settings';

export default function NewIncomeScreen() {
  const { t } = useTranslation();
  const uid = useSessionStore((state) => state.uid);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const isOnline = useNetworkStatus();

  async function handleSubmit(values: IncomeFormValues) {
    const currency = values.currency;
    const { exchangeRateToDefault, rateSource } = getConfiguredRate(currency, defaultCurrency);

    if (values.isRecurring) {
      if (!uid) return;
      const startDate = new Date();
      const categoryId = values.categoryId;
      const amount = parseAmountInput(values.amount);
      const dayOfMonth = values.frequency === 'monthly' ? Number(values.dayOfMonth) : null;

      const id = await addRecurringIncome({
        name: values.name,
        categoryId,
        amount,
        currency,
        exchangeRateToDefault,
        startDate,
        frequency: values.frequency,
        dayOfMonth,
        anchorDate: null, // defaults to startDate — see recurring-income-form.tsx
      });
      // Generate this period's instance immediately rather than waiting for
      // the next catch-up scan (src/app/_layout.tsx runs one on launch,
      // foreground-resume, and reconnect) — but only while online: this call
      // reads via getDocs(), which never resolves offline (no cached
      // fallback for a one-shot query), so awaiting it here would hang the
      // Save button indefinitely. Skipping it offline is safe — the
      // definition write above is already queued locally either way, and
      // the next resume/reconnect catch-up scan generates the missing
      // instance once back online.
      if (isOnline) {
        await generateIncomeInstancesForDefinition(
          uid,
          {
            id,
            categoryId,
            name: values.name,
            currency,
            exchangeRateToDefault,
            amount,
            frequency: values.frequency,
            dayOfMonth,
            anchorDate: null,
            startDate,
          },
          new Date(),
        );
      }
    } else {
      addIncome({
        name: values.name,
        categoryId: values.categoryId,
        amount: parseAmountInput(values.amount),
        currency,
        exchangeRateToDefault,
        rateSource,
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
        defaultCurrency={defaultCurrency}
        submitLabel={t('common.save')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
