import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format-currency';
import type { CurrencyCode } from '@/types/firestore';

export type SuggestedBudgetRowProps = {
  suggested: number;
  defaultCurrency: CurrencyCode;
};

// "Suggested budget: X" plus an info button that expands a short, plain-
// language explanation inline, used by the Set/Adjust budget sheet (D10).
// Inline rather than another sheet: that would stack a second modal on top
// of the sheet, which is clumsy on mobile. Kept as its own small component
// since it owns its expand/collapse state.
export function SuggestedBudgetRow({ suggested, defaultCurrency }: SuggestedBudgetRowProps) {
  const { t } = useTranslation();
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ThemedText type="small" style={styles.text}>
          {t('budget.setBudgetSheet.suggested', {
            amount: formatCurrency(suggested, defaultCurrency),
          })}
        </ThemedText>
        <IconButton
          name={{ ios: 'info.circle', android: 'info', web: 'info' }}
          onPress={() => setIsInfoOpen((open) => !open)}
          accessibilityLabel={t('budget.setBudgetSheet.suggestedInfoLabel')}
          style={styles.infoButton}
        />
      </View>
      {isInfoOpen && (
        <ThemedText type="caption">{t('budget.setBudgetSheet.suggestedInfo')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  text: {
    flexShrink: 1,
  },
  // Same trick as the summary card's ⓘ: keep the 44pt tap area without
  // making the row taller, and show only the icon.
  infoButton: {
    marginVertical: -(MinTouchTarget - 20) / 2,
    backgroundColor: 'transparent',
  },
});
