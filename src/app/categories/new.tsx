import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { normalizeMonthlyBudget } from '@/lib/budget-status';
import { parseAmountInput } from '@/lib/currency-input';
import { addCategory, useCategoriesStore } from '@/store/categories';
import { useUserSettingsStore } from '@/store/user-settings';

export default function NewCategoryScreen() {
  const { t } = useTranslation();
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const categories = useCategoriesStore((state) => state.items);

  function handleSubmit(values: CategoryFormValues) {
    addCategory({
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

  return (
    <ScreenScroll>
      <ModalHeader title={t('categories.addTitle')} />
      <CategoryForm
        submitLabel={t('common.create')}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        defaultCurrency={defaultCurrency}
        otherNames={categories.map((category) => category.name)}
      />
    </ScreenScroll>
  );
}
