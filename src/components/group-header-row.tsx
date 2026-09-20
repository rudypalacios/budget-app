import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency } from '@/lib/format-currency';
import type { GroupableItem, GroupSection } from '@/lib/recurring-groups';
import { Spacing } from '@/constants/theme';

type GroupHeaderProps<T extends GroupableItem> = {
  section: GroupSection<T>;
  expanded: boolean;
  onToggleExpanded: (groupId: string) => void;
  defaultCurrency: string;
};

// Stage 18 redo (FR-21f) — the group header row: name, member count,
// combined subtotal, and a chevron-accordion revealing members. Generic
// over T since it's reused by the Payments Dashboard (PaymentRow members)
// and the Expenses tab's "Una vez"/"Recurrentes" sections
// (RecurringExpense-definition-shaped members) — only ever touches
// section.groupId/name/members.length/subtotal, so the type signature is
// all that needs to change between them.
export function GroupHeaderRow<T extends GroupableItem>({
  section,
  expanded,
  onToggleExpanded,
  defaultCurrency,
}: GroupHeaderProps<T>) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View>
      <Pressable
        onPress={() => onToggleExpanded(section.groupId)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(expanded ? 'recurringGroups.hideMembers' : 'recurringGroups.showMembers', {
          name: section.name,
        })}
        style={styles.groupHeader}
      >
        <View style={styles.groupHeaderMain}>
          <ThemedText type="smallBold">{section.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('recurringGroups.memberCount', { count: section.members.length })}
          </ThemedText>
        </View>
        <View style={styles.groupHeaderAside}>
          <ThemedText type="smallBold">{formatCurrency(section.subtotal, defaultCurrency)}</ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stage 18 redo (FR-21f) — the group header row, same
  // Pressable-with-chevron accordion idiom as category-budget-card.tsx.
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
  },
  groupHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  groupHeaderAside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
