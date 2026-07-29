import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExpenseForm, type ExpenseFormValues } from '@/components/expense-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { parseAmountInput } from '@/lib/currency-input';
import { addExpense } from '@/store/expenses';
import { addRecurringExpense } from '@/store/recurring-expenses';
import { generateExpenseInstancesForDefinition } from '@/store/recurring-generation';
import { useSessionStore } from '@/store/session';
import { useUserSettingsStore } from '@/store/user-settings';

export default function NewExpenseScreen() {
  const { t } = useTranslation();
  const uid = useSessionStore((state) => state.uid);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  async function handleSubmit(values: ExpenseFormValues) {
    if (values.isRecurring) {
      if (!uid) return;
      const startDate = new Date();
      const categoryId = values.categoryId;
      const currency = defaultCurrency;
      const amount = parseAmountInput(values.amount);
      const dueDay = Number(values.dueDay);

      const id = await addRecurringExpense({ name: values.name, categoryId, amount, currency, dueDay, startDate });
      // Generate this period's instance immediately rather than waiting for
      // the next app launch's catch-up scan (src/app/_layout.tsx).
      await generateExpenseInstancesForDefinition(
        uid,
        { id, categoryId, name: values.name, currency, amount, dueDay, startDate },
        new Date(),
      );
    } else {
      addExpense({
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
      <ModalHeader title={t('expenses.addTitle')} />
      <ExpenseForm submitLabel={t('common.save')} onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
