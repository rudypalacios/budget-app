import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { getCurrencySymbol, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { CurrencyAddSheet } from '@/features/settings/currency-add-sheet';
import { CurrencyEditSheet } from '@/features/settings/currency-edit-sheet';
import { SettingsCard } from '@/features/settings/settings-card';
import { SettingsRow } from '@/features/settings/settings-row';
import { currencyDisplayName } from '@/lib/currency-display';
import { countPendingRecordsInCurrency } from '@/lib/currency-usage';
import { formatCurrency } from '@/lib/format-currency';
import { goBack } from '@/lib/navigation';
import { useCurrenciesStore } from '@/store/currencies';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useUserSettingsStore } from '@/store/user-settings';

// Layout per the ajustes-v2 prototype: the default currency on its own
// card, then one row per added currency showing its rate, where the rate
// came from and how many open records it still estimates. Tapping a row
// opens the rate/remove sheet; adding opens its own sheet.
export default function CurrenciesScreen() {
  const { t } = useTranslation();
  const currencies = useCurrenciesStore((state) => state.items);
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const addedCodes = currencies.map((currency) => currency.id);
  const addOptions = SUPPORTED_CURRENCIES.filter(
    (currency) => currency.code !== defaultCurrency && !addedCodes.includes(currency.code),
  ).map((currency) => ({ value: currency.code, label: currencyDisplayName(currency.code, t) }));
  const editingCurrency = currencies.find((currency) => currency.id === editingCode);

  return (
    <ScreenScroll>
      <ScreenHeader title={t('currencies.title')} onBack={() => goBack('/settings')} />

      <ThemedText type="small" themeColor="textSecondary">
        {t('currencies.intro')}
      </ThemedText>

      <SettingsCard>
        <SettingsRow
          leadingText={getCurrencySymbol(defaultCurrency)}
          title={currencyDisplayName(defaultCurrency, t)}
          subtitle={t('currencies.defaultLabel')}
        />
      </SettingsCard>

      {currencies.length === 0 ? (
        <ThemedText type="caption">{t('currencies.empty')}</ThemedText>
      ) : (
        <SettingsCard>
          {currencies.map((currency) => {
            const pendingCount = countPendingRecordsInCurrency(currency.id, expenses, incomes);
            const isStale = currency.status === 'stale';
            return (
              <SettingsRow
                key={currency.id}
                leadingText={getCurrencySymbol(currency.id)}
                title={currencyDisplayName(currency.id, t)}
                titleBadge={
                  isStale ? (
                    <Chip size="small" tone="warning" label={t('currencies.needsRefresh')} />
                  ) : undefined
                }
                subtitle={
                  <View>
                    <ThemedText type="caption">
                      {`${t('currencies.rateLine', {
                        code: currency.id,
                        rate: formatCurrency(currency.exchangeRateToDefault, defaultCurrency),
                      })} · ${t(
                        currency.rateSource === 'fetched'
                          ? 'currencies.sourceFetched'
                          : 'currencies.sourceManual',
                      )}`}
                    </ThemedText>
                    {pendingCount > 0 && (
                      <ThemedText type="caption">
                        {t('currencies.pendingUsage', { count: pendingCount })}
                      </ThemedText>
                    )}
                    {isStale && (
                      <ThemedText type="caption" themeColor="warning">
                        {t('currencies.staleHint')}
                      </ThemedText>
                    )}
                  </View>
                }
                value={t('currencies.editRate')}
                showChevron={false}
                onPress={() => setEditingCode(currency.id)}
                accessibilityLabel={t('currencies.editRateFor', { code: currency.id })}
              />
            );
          })}
        </SettingsCard>
      )}

      {addOptions.length > 0 ? (
        <Button
          label={t('currencies.addButton')}
          variant="secondary"
          onPress={() => setIsAdding(true)}
          style={styles.addButton}
        />
      ) : (
        <ThemedText type="caption">{t('currencies.allAdded')}</ThemedText>
      )}

      {editingCode && editingCurrency && (
        <CurrencyEditSheet
          key={editingCode}
          code={editingCode}
          currency={editingCurrency}
          defaultCurrency={defaultCurrency}
          onClose={() => setEditingCode(null)}
        />
      )}
      {isAdding && (
        <CurrencyAddSheet
          options={addOptions}
          defaultCurrency={defaultCurrency}
          onClose={() => setIsAdding(false)}
        />
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignSelf: 'flex-start',
    marginTop: -Spacing.two,
  },
});
