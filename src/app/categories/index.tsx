import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { CategoryActionsSheet } from '@/features/settings/category-actions-sheet';
import { SettingsCard } from '@/features/settings/settings-card';
import { SettingsRow } from '@/features/settings/settings-row';
import { SettingsSectionTitle } from '@/features/settings/settings-section-title';
import { countCategoryItems } from '@/lib/category-stats';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import { canDeleteCategory } from '@/lib/lifecycle-records';
import { goBack } from '@/lib/navigation';
import { useCategoriesStore } from '@/store/categories';
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

const SECTIONS = [
  { state: 'active', titleKey: 'categories.activeSection' },
  { state: 'archived', titleKey: 'categories.archivedSection' },
] as const;

// Layout per the ajustes-v2 prototype: active and archived categories in
// separate cards, each row with its icon (or initial), type, item count and
// budget, and a ⋮ button for Edit / Archive / Delete.
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = useCategoriesStore((state) => state.items);
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringExpenses = useRecurringExpensesStore((state) => state.items);
  const recurringIncomes = useRecurringIncomesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  const [menuTarget, setMenuTarget] = useState<WithId<Category> | null>(null);

  function renderRow(category: WithId<Category>) {
    const itemCount = countCategoryItems(
      category.id,
      expenses,
      incomes,
      recurringExpenses,
      recurringIncomes,
    );
    return (
      <SettingsRow
        key={category.id}
        leadingText={category.icon ?? category.name.charAt(0).toUpperCase()}
        title={category.name}
        titleBadge={
          category.isSystemDefault ? (
            <Chip size="small" label={t('categories.systemDefault')} />
          ) : undefined
        }
        subtitle={
          <View>
            <ThemedText type="caption">
              {`${t(TYPE_LABEL_KEY[category.type])} · ${t('categories.itemCount', { count: itemCount })}`}
            </ThemedText>
            <ThemedText type="caption">
              {category.monthlyBudget != null
                ? t('categories.budgetLabel', {
                    amount: formatCurrency(category.monthlyBudget, defaultCurrency),
                  })
                : t('categories.noBudget')}
            </ThemedText>
          </View>
        }
        trailing={
          <IconButton
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            onPress={() => setMenuTarget(category)}
            accessibilityLabel={t('common.actionsFor', { name: category.name })}
          />
        }
      />
    );
  }

  return (
    <ScreenScroll>
      <ScreenHeader title={t('categories.title')} onBack={() => goBack('/settings')} />

      <ThemedText type="small" themeColor="textSecondary">
        {t('categories.intro')}
      </ThemedText>
      <Button
        label={t('categories.addAction')}
        onPress={() => router.push('/categories/new')}
        style={styles.addButton}
      />

      {SECTIONS.map(({ state, titleKey }) => {
        const inSection = categories.filter((category) => category.lifecycleState === state);
        if (inSection.length === 0) return null;
        return (
          <View key={state} style={styles.section}>
            <SettingsSectionTitle title={t(titleKey)} />
            <SettingsCard>{inSection.map(renderRow)}</SettingsCard>
          </View>
        );
      })}

      {menuTarget && (
        <CategoryActionsSheet
          key={menuTarget.id}
          category={menuTarget}
          blockingCount={
            canDeleteCategory(menuTarget.id, expenses, incomes, recurringExpenses, recurringIncomes)
              .blockingCount
          }
          onClose={() => setMenuTarget(null)}
        />
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignSelf: 'flex-start',
  },
  section: {
    gap: Spacing.one + 2,
  },
});
