import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { normalizeMonthlyBudget, suggestCategoryBudget } from '@/lib/budget-status';
import { parseAmountInput } from '@/lib/currency-input';
import { updateCategory, useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useUserSettingsStore } from '@/store/user-settings';

export default function EditCategoryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useCategoriesStore((state) => state.items);
  const category = items.find((item) => item.id === id);
  const expenses = useExpensesStore((state) => state.items);
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
      // D1: 0, blank, or non-numeric all normalize to "no budget" (null).
      monthlyBudget: normalizeMonthlyBudget(
        values.monthlyBudget === '' ? null : parseAmountInput(values.monthlyBudget),
      ),
      icon: values.icon,
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
    // ?? null for the same undefined-vs-null reason — a category created
    // before this stage has no icon field at all.
    icon: category.icon ?? null,
  };

  // Income categories never show the monthlyBudget field (CategoryForm), so
  // there's no suggestion to compute for one.
  // D10: same suggestion as the Budget tab's "Set budget" sheet — what the
  // category costs in a normal month.
  const suggestedMonthlyBudget =
    category.type === 'income' ? null : suggestCategoryBudget(expenses, id);

  return (
    <ScreenScroll>
      <ModalHeader title={t('categories.editTitle')} />
      <CategoryForm
        initialValues={initialValues}
        submitLabel={t('common.saveChanges')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        defaultCurrency={defaultCurrency}
        otherNames={items.filter((item) => item.id !== id).map((item) => item.name)}
        suggestedMonthlyBudget={suggestedMonthlyBudget}
      />
    </ScreenScroll>
  );
}
