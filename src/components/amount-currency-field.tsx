import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Select, type SelectOption } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { FormRowBreakpoint, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import { sanitizeAmountInput } from '@/lib/currency-input';
import { useCurrenciesStore } from '@/store/currencies';
import type { CurrencyCode } from '@/types/firestore';

export type AmountCurrencyFieldProps = {
  amount: string;
  onAmountChange: (amount: string) => void;
  amountPlaceholder: string;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  defaultCurrency: CurrencyCode;
};

const CURRENCY_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.label]),
);

// Amount entry + currency picker, side by side on web above
// FormRowBreakpoint, stacked below it (native is always below it — see
// theme.ts). Used everywhere a record's currency is still editable
// (one-time/instance creation, recurring definitions always) — locked
// one-time/instance Edit keeps its own plain amount-only field, see
// ExpenseForm's disableCurrencyEdit path.
//
// Stage 11 redesign: the currency picker only ever offers currencies
// already configured in Settings (docs/data-model.md §3a) — no rate
// entry/fetch UI here at all, since the rate is copied from that
// configuration at submit time. If nothing has been configured yet, the
// picker doesn't render at all and the field silently stays in the
// default currency, matching pre-Stage-11 behavior.
export function AmountCurrencyField({
  amount,
  onAmountChange,
  amountPlaceholder,
  currency,
  onCurrencyChange,
  defaultCurrency,
}: AmountCurrencyFieldProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < FormRowBreakpoint;
  const addedCurrencies = useCurrenciesStore((state) => state.items);

  const usableCurrencies = addedCurrencies.filter((item) => item.status === 'ok');
  const options: SelectOption<CurrencyCode>[] = [
    { value: defaultCurrency, label: CURRENCY_LABEL_BY_CODE[defaultCurrency] ?? defaultCurrency },
    ...usableCurrencies.map((item) => ({
      value: item.id,
      label: CURRENCY_LABEL_BY_CODE[item.id] ?? item.id,
    })),
  ];
  // Defensive: keep the field's current value selectable even if it's since
  // gone stale or been removed from Settings, so the Select never silently
  // drops the current selection out from under the user.
  if (!options.some((option) => option.value === currency)) {
    options.push({ value: currency, label: CURRENCY_LABEL_BY_CODE[currency] ?? currency });
  }

  const selectedRate =
    currency === defaultCurrency
      ? 1
      : (addedCurrencies.find((item) => item.id === currency)?.exchangeRateToDefault ?? null);

  const currencyLabel =
    currency !== defaultCurrency && selectedRate !== null
      ? t('currencyRate.currencyWithRate', { rate: formatCurrency(selectedRate, defaultCurrency) })
      : t('currencyRate.currency');

  return (
    <View style={[styles.row, isNarrow && styles.rowNarrow]}>
      <View style={styles.amountField}>
        <TextField
          label={t('common.amount')}
          value={amount}
          onChangeText={(text) => onAmountChange(sanitizeAmountInput(text))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={amountPlaceholder}
        />
      </View>
      {options.length > 1 && (
        <View style={styles.currencyField}>
          <Select label={currencyLabel} value={currency} options={options} onChange={onCurrencyChange} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowNarrow: {
    flexDirection: 'column',
  },
  amountField: {
    flex: 1,
  },
  currencyField: {
    flex: 1,
  },
});
