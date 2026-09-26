import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { OptionRow } from './option-row';

export type DefaultCurrencySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  currentCurrency: string;
  onConfirm: (currency: string) => void;
};

const CONSEQUENCE_KEYS = [
  'settings.general.currencyConfirm.consequence1',
  'settings.general.currencyConfirm.consequence2',
  'settings.general.currencyConfirm.consequence3',
] as const;

// Lists every supported currency, not just the "added" ones (RN-AJU-5): the
// default needs no currencies/{code} row, since its rate to itself is 1.
// Picking a different one swaps this same sheet to a confirmation view
// instead of chaining a second sheet — avoids handing off between two Modals
// (see CLAUDE.md Known Issues on stale web Modal backdrops). It's the only
// Settings change that pauses before applying (RN-AJU-2), since it marks
// every added currency and budget recommendation stale.
export function DefaultCurrencySheet({
  isOpen,
  onClose,
  currentCurrency,
  onConfirm,
}: DefaultCurrencySheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);

  function close() {
    setPendingCurrency(null);
    onClose();
  }

  function handlePick(code: string) {
    if (code === currentCurrency) {
      close();
      return;
    }
    setPendingCurrency(code);
  }

  function handleConfirm() {
    if (!pendingCurrency) return;
    onConfirm(pendingCurrency);
    close();
  }

  if (pendingCurrency) {
    const title = t('settings.general.currencyConfirm.title', { currency: pendingCurrency });
    return (
      <ActionSheet isOpen={isOpen} onClose={close} title={title}>
        <View style={styles.consequences}>
          {CONSEQUENCE_KEYS.map((key) => (
            <View key={key} style={styles.consequence}>
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <ThemedText type="small" style={styles.consequenceText}>
                {t(key, { currency: pendingCurrency })}
              </ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => setPendingCurrency(null)}
            style={styles.button}
          />
          <Button
            label={t('settings.general.currencyConfirm.confirm', { currency: pendingCurrency })}
            // Danger-styled per the ajustes-v2 prototype: it's the one change
            // on this screen that marks dependent data stale.
            variant="danger"
            onPress={handleConfirm}
            style={styles.button}
          />
        </View>
      </ActionSheet>
    );
  }

  return (
    <ActionSheet isOpen={isOpen} onClose={close} title={t('settings.general.defaultCurrency')}>
      <View>
        {SUPPORTED_CURRENCIES.map((currency) => (
          <OptionRow
            key={currency.code}
            label={currency.label}
            isSelected={currency.code === currentCurrency}
            onPress={() => handlePick(currency.code)}
          />
        ))}
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  consequences: {
    gap: Spacing.one,
  },
  consequence: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one + 2,
  },
  consequenceText: {
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
