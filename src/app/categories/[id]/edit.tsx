import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { suggestCategoryMonthlyBudget } from '@/lib/budget-recommendation';
import { parseAmountInput } from '@/lib/currency-input';
import { updateCategory, useCategoriesStore } from '@/store/categories';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useUserSettingsStore } from '@/store/user-settings';

export default function EditCategoryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useCategoriesStore((state) => state.items);
  const category = items.find((item) => item.id === id);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  if (!category) {
    return (
      <ScreenScroll>
        <ModalHeader title={t('categories.notFoundTitle')} />
        <ThemedText>{t('categories.notFoundBody')}</ThemedText>
      </ScreenScroll>
    );
  }

  function handleSubmit(values: CategoryFormValues) {
    updateCategory(id, {
      name: values.name,
      type: values.type,
      monthlyBudget: values.monthlyBudget === '' ? null : parseAmountInput(values.monthlyBudget),
    });
    router.back();
  }

  const initialValues: CategoryFormValues = {
    name: category.name,
    type: category.type,
    // == null (not === null) deliberately catches both null and undefined —
    // a category document created before Stage 13 has no monthlyBudget
    // field at all, which reads back as undefined rather than null.
    monthlyBudget: category.monthlyBudget == null ? '' : String(category.monthlyBudget),
  };

  const activeRecurringExpenses = recurringExpenses.filter((definition) => definition.lifecycleState === 'active');
  const suggestedMonthlyBudget = suggestCategoryMonthlyBudget(id, activeRecurringExpenses, defaultCurrency);

  return (
    <ScreenScroll>
      <ModalHeader title={t('categories.editTitle')} />
      <CategoryForm
        initialValues={initialValues}
        submitLabel={t('common.saveChanges')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        defaultCurrency={defaultCurrency}
        suggestedMonthlyBudget={suggestedMonthlyBudget}
      />
    </ScreenScroll>
  );
}
