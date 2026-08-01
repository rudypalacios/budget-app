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
import { goBack } from '@/lib/navigation';
import { updateCategory, useCategoriesStore } from '@/store/categories';
import type { Category } from '@/types/firestore';

const TYPE_LABEL_KEY: Record<Category['type'], string> = {
  expense: 'categories.form.type.expense',
  income: 'categories.form.type.income',
  both: 'categories.form.type.both',
};

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = useCategoriesStore((state) => state.items);

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
        {categories.map((category, index) => (
          <View key={category.id}>
            <View style={styles.row}>
              <View style={styles.main}>
                <ThemedText type="smallBold">{category.name}</ThemedText>
                <Chip label={t(TYPE_LABEL_KEY[category.type])} />
              </View>
              <View style={styles.end}>
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
              </View>
            </View>
            {index < categories.length - 1 && <Divider style={styles.divider} />}
          </View>
        ))}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
