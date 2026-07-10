import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';

// No archive/trash toggle here — Stage 11 owns that UI. The generation
// engine (src/store/recurring-generation.ts) already filters
// lifecycleState === 'active', so archiving will correctly stop
// regeneration as soon as that UI exists.
export default function RecurringIncomesScreen() {
  const definitions = useRecurringIncomesStore((state) => state.items);
  const activeDefinitions = definitions.filter((definition) => definition.lifecycleState === 'active');

  return (
    <ScreenScroll>
      <ScreenHeader title="Recurring Income" onBack={() => router.back()} />

      <SectionHeader
        title="All recurring income"
        actionLabel="+ Add"
        onActionPress={() => router.push('/recurring-incomes/new')}
      />

      <Card style={styles.card}>
        {activeDefinitions.map((definition, index) => (
          <View key={definition.id}>
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <ThemedText type="smallBold">{definition.name}</ThemedText>
                <ThemedText type="caption">
                  {definition.frequency}
                  {definition.frequency === 'monthly' ? ` · day ${definition.dayOfMonth}` : ''}
                </ThemedText>
              </View>
              <View style={styles.rowEnd}>
                <ThemedText type="smallBold" themeColor="success">
                  {formatCurrency(definition.amount, definition.currency)}
                </ThemedText>
                <OverflowMenu
                  accessibilityLabel={`Actions for ${definition.name}`}
                  items={[
                    {
                      label: 'Edit',
                      onPress: () =>
                        router.push({ pathname: '/recurring-incomes/[id]/edit', params: { id: definition.id } }),
                    },
                  ]}
                />
              </View>
            </View>
            {index < activeDefinitions.length - 1 && <Divider style={styles.divider} />}
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
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.one,
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  divider: {
    marginVertical: Spacing.one,
  },
});
