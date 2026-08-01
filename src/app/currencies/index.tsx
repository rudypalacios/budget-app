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
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import { removeCurrency, useCurrenciesStore } from '@/store/currencies';
import { useUserSettingsStore } from '@/store/user-settings';

const CURRENCY_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.label]),
);

export default function CurrenciesScreen() {
  const { t } = useTranslation();
  const currencies = useCurrenciesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  return (
    <ScreenScroll>
      <ScreenHeader title={t('currencies.title')} onBack={() => router.back()} />

      <SectionHeader
        title={t('currencies.allCurrencies')}
        actionLabel={t('currencies.addAction')}
        onActionPress={() => router.push('/currencies/new')}
      />

      {currencies.length === 0 ? (
        <ThemedText type="caption">{t('currencies.empty')}</ThemedText>
      ) : (
        <Card style={styles.card}>
          {currencies.map((currency, index) => (
            <View key={currency.id}>
              <View style={styles.row}>
                <View style={styles.main}>
                  <ThemedText type="smallBold">{CURRENCY_LABEL_BY_CODE[currency.id] ?? currency.id}</ThemedText>
                  <ThemedText type="caption">
                    {formatCurrency(currency.exchangeRateToDefault, defaultCurrency)}
                  </ThemedText>
                  {currency.status === 'stale' && <Chip label={t('currencies.needsRefresh')} tone="warning" />}
                </View>
                <OverflowMenu
                  accessibilityLabel={t('common.actionsFor', { name: CURRENCY_LABEL_BY_CODE[currency.id] ?? currency.id })}
                  items={[
                    {
                      label: t('currencies.editRate'),
                      onPress: () =>
                        router.push({ pathname: '/currencies/[code]/edit', params: { code: currency.id } }),
                    },
                    {
                      label: t('common.remove'),
                      onPress: () => removeCurrency(currency.id),
                    },
                  ]}
                />
              </View>
              {index < currencies.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </Card>
      )}
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
  divider: {
    marginVertical: Spacing.one,
  },
});
