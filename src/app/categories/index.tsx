import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Switch } from '@/components/ui/switch';
import { Spacing } from '@/constants/theme';
import { categoryDisplayName } from '@/lib/category-display';
import { countCategoryItems } from '@/lib/category-stats';
import { formatCurrency } from '@/lib/format-currency';
import { goBack } from '@/lib/navigation';
import { updateCategory, useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useUserSettingsStore } from '@/store/user-settings';
import type { Category } from '@/types/firestore';

const TYPE_LABEL_KEY: Record<Category['type'], string> = {
  expense: 'categories.form.type.expense',
  income: 'categories.form.type.income',
  both: 'categories.form.type.both',
};

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = useCategoriesStore((state) => state.items);
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  function toggleActive(id: string, lifecycleState: 'active' | 'archived') {
    updateCategory(id, { lifecycleState: lifecycleState === 'active' ? 'archived' : 'active' });
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('categories.title')} onBack={() => goBack('/settings')} />

      <SectionHeader
        title={t('categories.allCategories')}
        actionLabel={t('categories.addAction')}
        onActionPress={() => router.push('/categories/new')}
      />

      <Card style={styles.card}>
        {categories.map((category, index) => {
          const itemCount = countCategoryItems(category.id, expenses, incomes, recurringExpenses, recurringIncomes);
          // Parens hold the item count, plus the budgeted amount when one's
          // set — e.g. "(12 · Q 500.00)" or just "(12)" for a budgetless
          // category (per the categories admin page request, CLAUDE.md
          // fix/ux-polish-round-3).
          const countLabel =
            category.monthlyBudget != null
              ? `(${itemCount} · ${formatCurrency(category.monthlyBudget, defaultCurrency)})`
              : `(${itemCount})`;

          return (
            <View key={category.id}>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{categoryDisplayName(category)}</ThemedText>
                  <View style={styles.rowMeta}>
                    <Chip label={t(TYPE_LABEL_KEY[category.type])} />
                    <ThemedText type="caption">{countLabel}</ThemedText>
                  </View>
                </View>
                <View style={styles.rowAside}>
                  <OverflowMenu
                    accessibilityLabel={t('common.actionsFor', { name: category.name })}
                    items={[
                      {
                        label: t('common.edit'),
                        onPress: () =>
                          router.push({ pathname: '/categories/[id]/edit', params: { id: category.id } }),
                      },
                    ]}
                  />
                  <View style={styles.switchRow}>
                    <ThemedText type="caption">
                      {category.lifecycleState === 'active' ? t('categories.active') : t('categories.archived')}
                    </ThemedText>
                    <Switch
                      value={category.lifecycleState === 'active'}
                      onValueChange={() => toggleActive(category.id, category.lifecycleState)}
                      accessibilityLabel={t('categories.markAs', {
                        name: category.name,
                        state:
                          category.lifecycleState === 'active'
                            ? t('categories.state.archived')
                            : t('categories.state.active'),
                      })}
                    />
                  </View>
                </View>
              </View>
              {index < categories.length - 1 && <Divider style={styles.divider} />}
            </View>
          );
        })}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  // Two-column/two-row grid, same strategy as the Payments Dashboard row
  // (src/app/(tabs)/index.tsx) — rowMain can wrap onto extra lines (a long
  // name plus the type chip plus the count/budget caption) without
  // colliding with rowAside's switch/menu, which used to happen on a single
  // flat row at narrow widths.
  row: {
    flexDirection: 'row',
    // Top-aligned, not centered — rowAside should stay pinned to the top
    // rather than vertically centering once rowMeta wraps onto extra lines,
    // matching the Payments row's own rationale.
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowAside: {
    gap: Spacing.one,
    alignItems: 'flex-end',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
