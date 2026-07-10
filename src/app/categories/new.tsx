import { router } from 'expo-router';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { categoriesStore } from '@/lib/mock-stores';

export default function NewCategoryScreen() {
  const { addItem } = categoriesStore.useStore();

  function handleSubmit(values: CategoryFormValues) {
    addItem({
      id: `cat-${Date.now()}`,
      name: values.name,
      type: values.type,
      lifecycleState: 'active',
    });
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title="Add category" />
      <CategoryForm submitLabel="Save" onSubmit={handleSubmit} onCancel={() => router.back()} />
    </ScreenScroll>
  );
}
