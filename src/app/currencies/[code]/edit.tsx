import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { fetchExchangeRate } from '@/lib/exchange-rate';
import { updateCurrencyRate, useCurrenciesStore } from '@/store/currencies';
import { useUserSettingsStore } from '@/store/user-settings';
import type { RateSource } from '@/types/firestore';

const CURRENCY_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.label]),
);

// Rate-refresh only — the currency/code itself isn't editable here (remove
// and re-add instead, see currencies/index.tsx), so this is a lighter form
// than currency-rate-field.tsx's Select+rate pairing: just the rate entry
// half of it, reused inline rather than extracted (only two call sites
// exist for that shape — see CurrencyRateField's own comment).
export default function EditCurrencyScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const items = useCurrenciesStore((state) => state.items);
  const currency = items.find((item) => item.id === code);
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  const isOnline = useNetworkStatus();

  const [rate, setRate] = useState(currency ? String(currency.exchangeRateToDefault) : '');
  const [rateSource, setRateSource] = useState<RateSource>(currency?.rateSource ?? 'manual');
  const [fetchError, setFetchError] = useState<string | null>(null);

  if (!code || !currency) {
    return (
      <ScreenScroll>
        <ModalHeader title={t('currencies.notFoundTitle')} />
        <ThemedText>{t('currencies.notFoundBody')}</ThemedText>
      </ScreenScroll>
    );
  }

  const parsedRate = parseAmountInput(rate);
  const isValid = Number.isFinite(parsedRate) && parsedRate > 0;

  async function handleFetchRate() {
    setFetchError(null);
    try {
      const fetchedRate = await fetchExchangeRate(code, defaultCurrency);
      setRate(String(fetchedRate));
      setRateSource('fetched');
    } catch {
      setFetchError(t('currencyRate.fetchError'));
    }
  }

  async function handleSave() {
    await updateCurrencyRate(code, parsedRate, rateSource);
    router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title={t('currencies.editTitle', { currency: CURRENCY_LABEL_BY_CODE[code] ?? code })} />

      <View style={styles.rateRow}>
        <View style={styles.rateField}>
          <TextField
            label={t('currencyRate.rate', { defaultCurrency })}
            value={rate}
            onChangeText={(text) => {
              setRate(sanitizeAmountInput(text));
              setRateSource('manual');
            }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={t('currencyRate.ratePlaceholder')}
          />
        </View>
        <Button label={t('currencyRate.fetchRate')} variant="secondary" onPress={handleFetchRate} disabled={!isOnline} />
      </View>
      {fetchError && (
        <ThemedText type="caption" themeColor="danger" accessibilityRole="alert">
          {fetchError}
        </ThemedText>
      )}
      <ThemedText type="caption" themeColor="textSecondary">
        {t('currencyRate.attribution')}
      </ThemedText>

      <Button label={t('common.saveChanges')} onPress={handleSave} disabled={!isValid} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  rateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  rateField: {
    flex: 1,
  },
});
