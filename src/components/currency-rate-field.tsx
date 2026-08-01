import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { sanitizeAmountInput } from '@/lib/currency-input';
import { fetchExchangeRate } from '@/lib/exchange-rate';
import type { CurrencyCode, RateSource } from '@/types/firestore';

export type CurrencyRateFieldProps = {
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  // The currency Select's own option list — passed in by the caller
  // rather than defaulting to the full SUPPORTED_CURRENCIES catalog,
  // since the one remaining caller (currencies/new.tsx, Stage 11
  // redesign) needs to exclude the default currency and whatever's
  // already been added.
  currencyOptions: readonly SelectOption<CurrencyCode>[];
  defaultCurrency: CurrencyCode;
  // Text, like the amount field — parsed with the same
  // sanitize/parseAmountInput pair used everywhere else in the app.
  rate: string;
  onRateChange: (rate: string) => void;
  // Omitted by callers whose record type has no rateSource field at all
  // (recurring definitions — see data-model.md §5 vs. §6: provenance is
  // only tracked on the generated instances/one-time records, not the
  // live template itself).
  onRateSourceChange?: (source: RateSource) => void;
};

// Currency Select + rate entry/fetch — since the Stage 11 redesign, this
// is exclusively the "add/refresh a configured currency" building block
// used by src/app/currencies/new.tsx and [code]/edit.tsx
// (docs/data-model.md §3a). It's no longer used by the transaction forms
// (ExpenseForm/IncomeForm/RecurringExpenseForm/RecurringIncomeForm),
// which now use AmountCurrencyField instead and only ever pick from
// already-configured currencies with no per-transaction rate entry.
export function CurrencyRateField({
  currency,
  onCurrencyChange,
  currencyOptions,
  defaultCurrency,
  rate,
  onRateChange,
  onRateSourceChange,
}: CurrencyRateFieldProps) {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const needsRate = currency !== defaultCurrency;

  async function handleFetchRate() {
    setFetchError(null);
    try {
      const fetchedRate = await fetchExchangeRate(currency, defaultCurrency);
      onRateChange(String(fetchedRate));
      onRateSourceChange?.('fetched');
    } catch {
      setFetchError(t('currencyRate.fetchError'));
    }
  }

  return (
    <View style={styles.container}>
      <Select
        label={t('currencyRate.currency')}
        value={currency}
        options={currencyOptions}
        onChange={(nextCurrency) => {
          onCurrencyChange(nextCurrency);
          setFetchError(null);
        }}
      />

      {needsRate && (
        <View style={styles.rateRow}>
          <View style={styles.rateField}>
            <TextField
              label={t('currencyRate.rate', { defaultCurrency })}
              value={rate}
              onChangeText={(text) => {
                onRateChange(sanitizeAmountInput(text));
                onRateSourceChange?.('manual');
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={t('currencyRate.ratePlaceholder')}
            />
          </View>
          <Button
            label={t('currencyRate.fetchRate')}
            variant="secondary"
            onPress={handleFetchRate}
            disabled={!isOnline}
          />
        </View>
      )}
      {needsRate && fetchError && (
        <ThemedText type="caption" themeColor="danger" accessibilityRole="alert">
          {fetchError}
        </ThemedText>
      )}
      {needsRate && (
        <ThemedText type="caption" themeColor="textSecondary">
          {t('currencyRate.attribution')}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  rateField: {
    flex: 1,
  },
});
