import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetMovementRow } from '@/components/budget-movement-row';
import { BudgetRecommendationBadge } from '@/components/budget-recommendation-badge';
import { SetBudgetSheet } from '@/components/set-budget-sheet';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isRecommendationPending } from '@/lib/budget-recommendation';
import {
  budgetPercent,
  projectedTotal,
  type BudgetStatus,
  type CategoryMovements,
} from '@/lib/budget-status';
import { categoryDisplayName } from '@/lib/category-display';
import type { WithId } from '@/lib/firebase/firestore.types';
import { formatCurrency } from '@/lib/format-currency';
import type { Category, CurrencyCode, ExpenseRecord, RecurringExpense } from '@/types/firestore';

export type CategoryBudgetCardProps = {
  category: WithId<Category>;
  // All figures come precomputed from budget-status.ts (Presupuesto
  // redesign §5) — this card only presents them, it never re-derives status.
  budgeted: number | null; // already normalized: 0/blank means null
  actual: number;
  pending: number;
  status: BudgetStatus;
  defaultCurrency: CurrencyCode;
  // Active recurring expenses in this category — the per-bill breakdown
  // (Stage 13 user feedback: a single category total can hide which
  // specific bill actually changed, e.g. "Services" masking that only
  // Electrical drifted). Summary by default; this only renders once expanded.
  recurringExpensesInCategory: WithId<RecurringExpense>[];
  // D9: this cycle's expenses behind `pending` and `actual` (categoryMovements).
  movements: CategoryMovements<WithId<ExpenseRecord>>;
  // D10: what this category costs in a normal month (suggestCategoryBudget).
  suggestedBudget: number | null;
};

// v9: the two attention chips carry their own icon (alert circle / alert
// triangle), so the status reads without the color.
const STATUS_CHIP: Partial<
  Record<
    BudgetStatus,
    { labelKey: string; tone: 'danger' | 'warning'; icon: SymbolViewProps['name'] }
  >
> = {
  over: {
    labelKey: 'budget.overBudgetChip',
    tone: 'danger',
    icon: { ios: 'exclamationmark.circle', android: 'error', web: 'error' },
  },
  mayExceed: {
    labelKey: 'budget.mayExceedChip',
    tone: 'warning',
    icon: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  },
};

// SymbolView ignores `style` on web, so the open/closed state swaps the icon
// itself instead of rotating one — shared with budget.tsx's "No budget" row.
export function ExpandChevron({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <SymbolView
      name={
        expanded
          ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
          : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
      }
      size={18}
      tintColor={color}
    />
  );
}

const A11Y_STATUS_KEY: Partial<Record<BudgetStatus, string>> = {
  over: 'budget.a11y.statusOver',
  mayExceed: 'budget.a11y.statusMayExceed',
  exact: 'budget.a11y.statusExact',
};

export function CategoryBudgetCard({
  category,
  budgeted,
  actual,
  pending,
  status,
  defaultCurrency,
  recurringExpensesInCategory,
  movements,
  suggestedBudget,
}: CategoryBudgetCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isSetBudgetOpen, setIsSetBudgetOpen] = useState(false);

  const name = categoryDisplayName(category);
  const chip = STATUS_CHIP[status];
  const percent = budgetPercent(budgeted, actual);
  const format = (amount: number) => formatCurrency(amount, defaultCurrency);

  // The whole face is one button, so its label carries everything the bar,
  // chip and chevron show visually (color is never the only signal, §9).
  const toggle = t(expanded ? 'budget.a11y.hide' : 'budget.a11y.show');
  const statusKey = A11Y_STATUS_KEY[status];
  const accessibilityLabel =
    budgeted === null
      ? t('budget.a11y.cardNoBudget', { name, spent: format(actual), toggle })
      : t('budget.a11y.card', {
          name,
          percent,
          spent: format(actual),
          budgeted: format(budgeted),
          status: statusKey ? t(statusKey) : '',
          toggle,
        });

  return (
    // v9: an over-budget card is outlined in the danger color too, so it
    // stands out in the list without relying on the chip/bar alone.
    <Card
      style={[
        styles.categoryCard,
        status === 'over' && { borderWidth: 1, borderColor: theme.dangerBorder },
      ]}
    >
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        style={styles.face}
      >
        <View style={styles.faceRow}>
          <View style={styles.faceMain}>
            <ThemedText type="smallBold" style={styles.name}>
              {name}
            </ThemedText>
            {chip && (
              <Chip
                label={t(chip.labelKey)}
                tone={chip.tone}
                icon={chip.icon}
                size="small"
                style={styles.chip}
              />
            )}
          </View>
          <View style={styles.faceAmounts}>
            <ThemedText type="smallBold" style={styles.amount}>
              {format(actual)}
            </ThemedText>
            <ThemedText type="caption">
              {budgeted === null
                ? t('budget.noBudgetSet')
                : t('budget.ofBudgeted', { amount: format(budgeted) })}
            </ThemedText>
          </View>
          <ExpandChevron expanded={expanded} color={theme.textSecondary} />
        </View>
        {budgeted !== null && status !== 'none' && (
          <ProgressBar status={status} budgeted={budgeted} actual={actual} />
        )}
      </Pressable>

      {expanded && (
        <View style={[styles.detail, { borderTopColor: theme.border }]}>
          <View style={styles.section}>
            <CategoryStatusLines
              status={status}
              budgeted={budgeted}
              actual={actual}
              pending={pending}
              percent={percent}
              format={format}
            />
          </View>
          <MovementsSection
            movements={movements}
            recurringDefinitions={recurringExpensesInCategory}
            defaultCurrency={defaultCurrency}
          />
          {/* D13: a budget is a goal, not a forecast — so no nagging banner
              at category level (the over-budget chip already warns, and a
              recurring bill's drift has its own recommendation, which would
              otherwise double up here). The user decides when to move the
              goal; the suggestion lives inside the Set/Adjust sheet only. */}
          <Button
            label={t(budgeted === null ? 'budget.setBudget' : 'budget.adjustBudget')}
            variant="secondary"
            onPress={() => setIsSetBudgetOpen(true)}
          />
        </View>
      )}

      <SetBudgetSheet
        isOpen={isSetBudgetOpen}
        onClose={() => setIsSetBudgetOpen(false)}
        category={category}
        defaultCurrency={defaultCurrency}
        suggested={suggestedBudget}
      />
    </Card>
  );
}

type CategoryStatusLinesProps = {
  status: BudgetStatus;
  budgeted: number | null;
  actual: number;
  pending: number;
  percent: number;
  format: (amount: number) => string;
};

// §5.6 points 1-2: one status line, plus a projection line whenever
// something is still pending this cycle. Whole lines are colored (not just
// the amount) — agreed simplification to avoid <Trans> markup.
function CategoryStatusLines({
  status,
  budgeted,
  actual,
  pending,
  percent,
  format,
}: CategoryStatusLinesProps) {
  const { t } = useTranslation();

  if (budgeted === null) {
    return (
      <>
        <ThemedText type="caption">{t('budget.detail.noBudget')}</ThemedText>
        {pending > 0 && (
          <ThemedText type="caption" themeColor="textSecondary">
            {t('budget.detail.pendingNoBudget', { pending: format(pending) })}
          </ThemedText>
        )}
      </>
    );
  }

  const projected = projectedTotal(actual, pending);

  return (
    <>
      {status === 'over' ? (
        <ThemedText type="caption" themeColor="danger">
          {t('budget.detail.over', { amount: format(actual - budgeted), percent })}
        </ThemedText>
      ) : status === 'exact' ? (
        <ThemedText type="caption" themeColor="success">
          {t('budget.detail.exact')}
        </ThemedText>
      ) : (
        <ThemedText type="caption">
          {t('budget.detail.remaining', { amount: format(budgeted - actual), percent })}
        </ThemedText>
      )}
      {pending > 0 && (
        <ThemedText type="caption" themeColor={projected > budgeted ? 'warning' : 'textSecondary'}>
          {t('budget.detail.projection', {
            pending: format(pending),
            projected: format(projected),
            percent: budgetPercent(budgeted, projected),
          })}
        </ThemedText>
      )}
    </>
  );
}

// Enough to see what drives the figures without turning a busy category
// into an endless card; the rest is one tap away.
const MOVEMENTS_PREVIEW_COUNT = 10;

type MovementsSectionProps = {
  movements: CategoryMovements<WithId<ExpenseRecord>>;
  // To attach a pending recommendation to its recurring expense's movement.
  recurringDefinitions: WithId<RecurringExpense>[];
  defaultCurrency: CurrencyCode;
};

// D9 + D11: pending first (what's still coming), then paid. This is the
// only list in the detail — recurring expenses show up here as their
// instances (with a "Recurring" chip) rather than in a separate section,
// which used to repeat them. A pending budget recommendation, the one
// actionable thing that section had, now sits right under the movement it
// comes from.
function MovementsSection({
  movements,
  recurringDefinitions,
  defaultCurrency,
}: MovementsSectionProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const all = [...movements.pending, ...movements.paid];
  if (all.length === 0) return null;

  const visible = showAll ? all : all.slice(0, MOVEMENTS_PREVIEW_COUNT);
  const hasMore = all.length > MOVEMENTS_PREVIEW_COUNT;

  const definitionsById = new Map(
    recurringDefinitions.map((definition) => [definition.id, definition]),
  );
  // A definition can have more than one instance in a cycle (e.g. biweekly);
  // its recommendation is shown once, under the first visible one.
  const recommendationShownFor = new Set<string>();

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{t('budget.detail.movements')}</ThemedText>
      {visible.map((expense, index) => {
        const definition =
          expense.kind === 'recurringInstance'
            ? definitionsById.get(expense.recurringExpenseId)
            : undefined;
        const showRecommendation =
          definition !== undefined &&
          isRecommendationPending(definition.budgetRecommendation) &&
          !recommendationShownFor.has(definition.id);
        if (showRecommendation) recommendationShownFor.add(definition.id);

        return (
          <View key={expense.id} style={styles.movement}>
            {index > 0 && <Divider />}
            <BudgetMovementRow expense={expense} defaultCurrency={defaultCurrency} />
            {showRecommendation && <BudgetRecommendationBadge definition={definition} />}
          </View>
        );
      })}
      {hasMore && (
        <Button
          label={
            showAll
              ? t('budget.detail.showLess')
              : t('budget.detail.showAll', { count: all.length })
          }
          variant="ghost"
          onPress={() => setShowAll((value) => !value)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    gap: Spacing.two,
  },
  face: {
    gap: Spacing.two,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  name: {
    fontSize: 15,
  },
  amount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  faceMain: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  faceAmounts: {
    alignItems: 'flex-end',
  },
  // v9: a hairline separates the card's face from its expanded detail;
  // sections inside it are separated by spacing alone.
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  movement: {
    gap: Spacing.two,
  },
});
