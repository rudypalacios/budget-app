import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { OverflowMenu } from '@/components/ui/overflow-menu';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatCurrency } from '@/lib/format-currency';
import { useCategoriesStore } from '@/store/categories';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';

// This screen is config-only: creating/editing planned income (one-time or
// recurring templates). Marking a specific occurrence received/expected/
// skipped — and the overdue tag — lives exclusively on the Payments tab
// (src/app/(tabs)/index.tsx, the Payments screen, Stage 8), which already
// unifies both kinds.
export default function IncomeScreen() {
  const { t } = useTranslation();
  const incomes = useIncomesStore((state) => state.items);
  const categories = useCategoriesStore((state) => state.items);
  const recurringDefinitions = useRecurringIncomesStore((state) => state.items);

  const activeRecurring = recurringDefinitions.filter((definition) => definition.lifecycleState === 'active');
  const { refreshing, onRefresh } = usePullToRefresh();

  // Once a one-time income is received it's settled history, not a plan
  // anymore — it stays visible via Payments' "Completed this cycle" and
  // the History tab, but drops off this planning list.
  const plannedOneTime = [...incomes.filter((income) => income.kind === 'oneTime' && !income.paid)].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis(),
  );

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t('income.title')} />

      <Button label={t('income.addIncome')} onPress={() => router.push('/income/new')} />

      <View style={styles.section}>
        <SectionHeader title={t('income.recurringSection')} />
        {activeRecurring.length === 0 ? (
          <ThemedText type="caption">{t('income.noRecurring')}</ThemedText>
        ) : (
          <Card style={styles.card}>
            {activeRecurring.map((definition, index) => (
              <View key={definition.id}>
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <ThemedText type="smallBold">{definition.name}</ThemedText>
                    <ThemedText type="caption">
                      {definition.frequency === 'monthly'
                        ? t('income.frequency.monthlyDay', { day: definition.dayOfMonth })
                        : definition.frequency === 'biweekly'
                          ? t('income.frequency.biweekly')
                          : t('income.frequency.weekly')}
                    </ThemedText>
                  </View>
                  <View style={styles.rowEnd}>
                    <ThemedText type="smallBold" themeColor="success">
                      {formatCurrency(definition.amount, definition.currency)}
                    </ThemedText>
                    <OverflowMenu
                      accessibilityLabel={t('common.actionsFor', { name: definition.name })}
                      items={[
                        {
                          label: t('common.edit'),
                          onPress: () =>
                            router.push({ pathname: '/recurring-incomes/[id]/edit', params: { id: definition.id } }),
                        },
                      ]}
                    />
                  </View>
                </View>
                {index < activeRecurring.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('income.oneTimeSection')} />
        {plannedOneTime.length === 0 ? (
          <ThemedText type="caption">{t('income.noOneTime')}</ThemedText>
        ) : (
          <Card style={styles.card}>
            {plannedOneTime.map((income, index) => {
              const category = categories.find((c) => c.id === income.categoryId);
              return (
                <View key={income.id}>
                  <View style={styles.row}>
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold">{income.name}</ThemedText>
                      <ThemedText type="caption">{category?.name}</ThemedText>
                    </View>
                    <View style={styles.rowEnd}>
                      <ThemedText type="smallBold" themeColor="success">
                        {formatCurrency(income.amount, income.currency)}
                      </ThemedText>
                      <OverflowMenu
                        accessibilityLabel={t('common.actionsFor', { name: income.name })}
                        items={[
                          {
                            label: t('common.edit'),
                            onPress: () => router.push({ pathname: '/income/[id]/edit', params: { id: income.id } }),
                          },
                        ]}
                      />
                    </View>
                  </View>
                  {index < plannedOneTime.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
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
