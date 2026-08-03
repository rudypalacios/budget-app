import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/currency-input';

export type ConfirmAmountModalProps = {
  isOpen: boolean;
  title: string;
  // Plain string, not CurrencyCode — matches PaymentRow.currency (the only
  // caller today), which is likewise untyped beyond string. Only ever used
  // for display here.
  currency: string;
  initialAmount: number;
  onSave: (amount: number) => void;
  onDiscard: () => void;
};

// Marking a recurring instance paid/received often needs a quick correction
// — e.g. a groceries bill budgeted at 1,000 that actually came in at 500 —
// without a full trip to the edit screen. Prefilled with the budgeted/
// current amount, editable, Save commits the (possibly edited) amount,
// Discard cancels entirely and leaves the row unpaid/unreceived.
export function ConfirmAmountModal({
  isOpen,
  title,
  currency,
  initialAmount,
  onSave,
  onDiscard,
}: ConfirmAmountModalProps) {
  const { t } = useTranslation();
  // The caller mounts this component keyed by the row's id (see index.tsx),
  // so a fresh instance — and fresh initial state — is guaranteed per row.
  const [amount, setAmount] = useState(() => String(initialAmount));

  const parsedAmount = parseAmountInput(amount);
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <Dialog isOpen={isOpen} onClose={onDiscard} title={title}>
      <TextField
        label={t('common.amountWithCurrency', { currency })}
        value={amount}
        onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <View style={styles.actionRow}>
        <Button
          label={t('payments.confirmAmount.save')}
          onPress={() => onSave(parsedAmount)}
          disabled={!isValid}
          style={styles.actionButton}
        />
        <Button
          label={t('payments.confirmAmount.discard')}
          variant="secondary"
          onPress={onDiscard}
          style={styles.actionButton}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
