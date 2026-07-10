import { router } from 'expo-router';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { addCategory } from '@/store/categories';

export default function NewCategoryScreen() {
  function handleSubmit(values: CategoryFormValues) {
    addCategory({ name: values.name, type: values.type });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add category" />
      <CategoryForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
