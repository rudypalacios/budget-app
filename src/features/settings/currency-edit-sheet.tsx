import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { ActionSheetItem } from '@/components/ui/action-sheet-item';
import { Button } from '@/components/ui/button';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';
import { fetchExchangeRate } from '@/lib/exchange-rate';
import { removeCurrency, updateCurrencyRate } from '@/store/currencies';
import { showToast } from '@/store/toast';
import type { AddedCurrency, CurrencyCode, RateSource } from '@/types/firestore';

export type CurrencyEditSheetProps = {
  code: CurrencyCode;
  currency: AddedCurrency;
  defaultCurrency: CurrencyCode;
  onClose: () => void;
};

// Rate refresh for an added currency, plus removing it — a bottom sheet per
// the ajustes-v2 prototype (it used to be the currencies/[code]/edit
// screen). The currency itself isn't editable here: remove and re-add
// instead. Mounted only while open, so its local state starts fresh from the
// stored rate each time.
//
// Writes aren't awaited: Firestore only resolves them on server ack, which
// never comes offline, and the local cache already reflects the change.
export function CurrencyEditSheet({
  code,
  currency,
  defaultCurrency,
  onClose,
}: CurrencyEditSheetProps) {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [rate, setRate] = useState(String(currency.exchangeRateToDefault));
  const [rateSource, setRateSource] = useState<RateSource>(currency.rateSource);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  function handleSave() {
    updateCurrencyRate(code, parsedRate, rateSource).catch(() => {
      showToast(t('currencies.saveFailed'));
    });
    onClose();
    showToast(t('currencies.rateUpdated', { code }));
  }

  function handleRemove() {
    removeCurrency(code).catch(() => {
      showToast(t('currencies.saveFailed'));
    });
    onClose();
    showToast(t('currencies.removed', { code }));
  }

  return (
    <ActionSheet isOpen onClose={onClose} title={t('currencies.editTitle', { currency: code })}>
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
        <Button
          label={t('currencyRate.fetchRate')}
          variant="secondary"
          onPress={handleFetchRate}
          disabled={!isOnline}
        />
      </View>
      {fetchError && (
        <ThemedText type="caption" themeColor="danger" accessibilityRole="alert">
          {fetchError}
        </ThemedText>
      )}
      <View style={styles.hints}>
        <ThemedText type="caption">{t('currencyRate.attribution')}</ThemedText>
        <ThemedText type="caption">{t('currencies.usageHint')}</ThemedText>
      </View>
      <SheetButtons
        onCancel={onClose}
        confirmLabel={t('common.save')}
        onConfirm={handleSave}
        confirmDisabled={!isValid}
      />
      <ActionSheetItem
        icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
        label={t('currencies.remove')}
        tone="danger"
        onPress={handleRemove}
      />
    </ActionSheet>
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
  hints: {
    gap: Spacing.one,
  },
});
