import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addCategory } from '@/store/categories';

export default function NewCategoryScreen() {
  const { t } = useTranslation();

  function handleSubmit(values: CategoryFormValues) {
    addCategory({ name: values.name, type: values.type });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title={t('categories.addTitle')} />
      <CategoryForm submitLabel={t('common.save')} onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
