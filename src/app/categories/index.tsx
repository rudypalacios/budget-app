import { router } from 'expo-router';
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
import { updateCategory, useCategoriesStore } from '@/store/categories';

export default function CategoriesScreen() {
  const categories = useCategoriesStore((state) => state.items);

  function toggleActive(id: string, lifecycleState: 'active' | 'archived') {
    updateCategory(id, { lifecycleState: lifecycleState === 'active' ? 'archived' : 'active' });
  }

  return (
    <ScreenScroll>
      <ScreenHeader title="Categories" onBack={() => router.back()} />

      <SectionHeader title="All categories" actionLabel="+ Add" onActionPress={() => router.push('/categories/new')} />

      <Card style={styles.card}>
        {categories.map((category, index) => (
          <View key={category.id}>
            <View style={styles.row}>
              <View style={styles.main}>
                <ThemedText type="smallBold">{category.name}</ThemedText>
                <Chip label={category.type} />
              </View>
              <View style={styles.end}>
                <View style={styles.switchRow}>
                  <ThemedText type="caption">
                    {category.lifecycleState === 'active' ? 'Active' : 'Archived'}
                  </ThemedText>
                  <Switch
                    value={category.lifecycleState === 'active'}
                    onValueChange={() => toggleActive(category.id, category.lifecycleState)}
                    accessibilityLabel={`Mark ${category.name} as ${
                      category.lifecycleState === 'active' ? 'archived' : 'active'
                    }`}
                  />
                </View>
                <OverflowMenu
                  accessibilityLabel={`Actions for ${category.name}`}
                  items={[
                    {
                      label: 'Edit',
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
