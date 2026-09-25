import type { Category } from '@/types/firestore';

// Every screen that lists a category by name (Payments dashboard, Expenses/
// Income/History tabs, category Selects, the categories admin list, the
// Budget tab's category card) wants the same "emoji + name" presentation
// once a category has an icon set — centralized here instead of duplicated
// per call site (it already was, 4+ times, before this existed).
export function categoryDisplayName(
  category: Pick<Category, 'name' | 'icon'> | undefined | null,
): string {
  if (!category) return '';
  return category.icon ? `${category.icon} ${category.name}` : category.name;
}
