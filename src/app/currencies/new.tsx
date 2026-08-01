import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CurrencyRateField } from '@/components/currency-rate-field';
import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { parseAmountInput } from '@/lib/currency-input';
import { addCurrency, useCurrenciesStore } from '@/store/currencies';
import { useUserSettingsStore } from '@/store/user-settings';
import type { CurrencyCode, RateSource } from '@/types/firestore';

export default function NewCurrencyScreen() {
  const { t } = useTranslation();
  const defaultCurrency = useUserSettingsStore((state) => state.data?.defaultCurrency ?? 'GTQ');
  // Select the stable items array reference itself, not a derived .map() —
  // a selector that returns a fresh array every call defeats
  // useSyncExternalStore's snapshot-equality check and causes an infinite
  // render loop. Derive addedCodes/availableOptions in the render body
  // instead, same pattern as AmountCurrencyField.
  const addedCurrencies = useCurrenciesStore((state) => state.items);
  const addedCodes = addedCurrencies.map((item) => item.id);

  const availableOptions = SUPPORTED_CURRENCIES.filter(
    (c) => c.code !== defaultCurrency && !addedCodes.includes(c.code),
  ).map((c) => ({ value: c.code, label: c.label }));

  const [currency, setCurrency] = useState<CurrencyCode>(availableOptions[0]?.value ?? '');
  const [rate, setRate] = useState('');
  const [rateSource, setRateSource] = useState<RateSource>('manual');

  const parsedRate = parseAmountInput(rate);
  const isValid = !!currency && Number.isFinite(parsedRate) && parsedRate > 0;

  async function handleSave() {
    await addCurrency(currency, parsedRate, rateSource);
    router.back();
  }

  if (availableOptions.length === 0) {
    return (
      <ScreenScroll>
        <ModalHeader title={t('currencies.addTitle')} />
        <ThemedText>{t('currencies.allAdded')}</ThemedText>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <ModalHeader title={t('currencies.addTitle')} />
      <CurrencyRateField
        currency={currency}
        onCurrencyChange={setCurrency}
        currencyOptions={availableOptions}
        defaultCurrency={defaultCurrency}
        rate={rate}
        onRateChange={setRate}
        onRateSourceChange={setRateSource}
      />
      <Button label={t('common.save')} onPress={handleSave} disabled={!isValid} />
    </ScreenScroll>
  );
}
