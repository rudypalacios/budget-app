import { router, useLocalSearchParams } from 'expo-router';

import { CategoryForm, type CategoryFormValues } from '@/components/category-form';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { updateCategory, useCategoriesStore } from '@/store/categories';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = useCategoriesStore((state) => state.items);
  const category = items.find((item) => item.id === id);

  if (!category) {
    return (
      <ScreenScroll>
        <ModalHeader title="Category not found" />
        <ThemedText>This category no longer exists.</ThemedText>
      </ScreenScroll>
    );
  }

  function handleSubmit(values: CategoryFormValues) {
    updateCategory(id, { name: values.name, type: values.type });
    router.back();
  }

  const initialValues: CategoryFormValues = {
    name: category.name,
    type: category.type,
  };

  return (
    <ScreenScroll>
      <ModalHeader title="Edit category" />
      <CategoryForm
        initialValues={initialValues}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </ScreenScroll>
  );
}
