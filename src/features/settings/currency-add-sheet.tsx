import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CurrencyRateField } from '@/components/currency-rate-field';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { SheetButtons } from '@/components/ui/sheet-buttons';
import { parseAmountInput } from '@/lib/currency-input';
import { addCurrency } from '@/store/currencies';
import { showToast } from '@/store/toast';
import type { CurrencyCode, RateSource } from '@/types/firestore';

export type CurrencyAddSheetProps = {
  // Supported currencies not yet added and not the default, already
  // labelled for display. The caller only opens this sheet when it's
  // non-empty.
  options: readonly { value: CurrencyCode; label: string }[];
  defaultCurrency: CurrencyCode;
  onClose: () => void;
};

// Add a currency with its rate — a bottom sheet per the ajustes-v2
// prototype (it used to be the currencies/new screen). CurrencyRateField
// itself (currency picker + rate + fetch) is unchanged. Mounted only while
// open, so its state starts fresh each time. The write isn't awaited, for
// the same offline reason as CurrencyEditSheet.
export function CurrencyAddSheet({ options, defaultCurrency, onClose }: CurrencyAddSheetProps) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<CurrencyCode>(options[0]?.value ?? '');
  const [rate, setRate] = useState('');
  const [rateSource, setRateSource] = useState<RateSource>('manual');

  const parsedRate = parseAmountInput(rate);
  const isValid = !!currency && Number.isFinite(parsedRate) && parsedRate > 0;

  function handleAdd() {
    addCurrency(currency, parsedRate, rateSource).catch(() => {
      showToast(t('currencies.saveFailed'));
    });
    onClose();
    showToast(t('currencies.added', { code: currency }));
  }

  return (
    <ActionSheet isOpen onClose={onClose} title={t('currencies.addTitle')}>
      <CurrencyRateField
        currency={currency}
        onCurrencyChange={setCurrency}
        currencyOptions={options}
        defaultCurrency={defaultCurrency}
        rate={rate}
        onRateChange={setRate}
        onRateSourceChange={setRateSource}
      />
      <ThemedText type="caption">{t('currencies.usageHint')}</ThemedText>
      <SheetButtons
        onCancel={onClose}
        confirmLabel={t('currencies.addConfirm')}
        onConfirm={handleAdd}
        confirmDisabled={!isValid}
      />
    </ActionSheet>
  );
}
