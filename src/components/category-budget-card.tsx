import { SymbolView } from 'expo-symbols';
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
import { budgetPercent, projectedTotal, type BudgetStatus, type CategoryMovements } from '@/lib/budget-status';
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
};

const STATUS_CHIP: Partial<Record<BudgetStatus, { labelKey: string; tone: 'danger' | 'warning' }>> = {
  over: { labelKey: 'budget.overBudgetChip', tone: 'danger' },
  mayExceed: { labelKey: 'budget.mayExceedChip', tone: 'warning' },
};

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
    <Card style={styles.categoryCard}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        style={styles.face}
      >
        <View style={styles.faceRow}>
          <View style={styles.faceMain}>
            <ThemedText type="smallBold">{name}</ThemedText>
            {chip && <Chip label={t(chip.labelKey)} tone={chip.tone} style={styles.chip} />}
          </View>
          <View style={styles.faceAmounts}>
            <ThemedText type="smallBold">{format(actual)}</ThemedText>
            <ThemedText type="caption">
              {budgeted === null ? t('budget.noBudgetSet') : t('budget.ofBudgeted', { amount: format(budgeted) })}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        </View>
        {budgeted !== null && status !== 'none' && (
          <ProgressBar status={status} budgeted={budgeted} actual={actual} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
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
          <MovementsSection movements={movements} defaultCurrency={defaultCurrency} />
          <RecurringSection definitions={recurringExpensesInCategory} format={format} />
          {/* §5.6 point 4 / fase 6: only a category with no budget gets an
              action here; changing an existing one lives in Settings. */}
          {status === 'none' && (
            <Button label={t('budget.setBudget')} variant="secondary" onPress={() => setIsSetBudgetOpen(true)} />
          )}
        </View>
      )}

      {status === 'none' && (
        <SetBudgetSheet
          isOpen={isSetBudgetOpen}
          onClose={() => setIsSetBudgetOpen(false)}
          category={category}
          recurringExpensesInCategory={recurringExpensesInCategory}
          defaultCurrency={defaultCurrency}
        />
      )}
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
function CategoryStatusLines({ status, budgeted, actual, pending, percent, format }: CategoryStatusLinesProps) {
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
        <ThemedText type="caption">{t('budget.detail.remaining', { amount: format(budgeted - actual), percent })}</ThemedText>
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
  defaultCurrency: CurrencyCode;
};

// D9: pending first (what's still coming), then paid.
function MovementsSection({ movements, defaultCurrency }: MovementsSectionProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const all = [...movements.pending, ...movements.paid];
  if (all.length === 0) return null;

  const visible = showAll ? all : all.slice(0, MOVEMENTS_PREVIEW_COUNT);
  const hasMore = all.length > MOVEMENTS_PREVIEW_COUNT;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{t('budget.detail.movements')}</ThemedText>
      {visible.map((expense) => (
        <BudgetMovementRow key={expense.id} expense={expense} defaultCurrency={defaultCurrency} />
      ))}
      {hasMore && (
        <Button
          label={showAll ? t('budget.detail.showLess') : t('budget.detail.showAll', { count: all.length })}
          variant="ghost"
          onPress={() => setShowAll((value) => !value)}
        />
      )}
    </View>
  );
}

type RecurringSectionProps = {
  definitions: WithId<RecurringExpense>[];
  format: (amount: number) => string;
};

// §5.6 point 3: the plan side (each recurring's amount + its 6-month
// average or recommendation), as opposed to MovementsSection's actuals.
function RecurringSection({ definitions, format }: RecurringSectionProps) {
  const { t } = useTranslation();

  if (definitions.length === 0) {
    return (
      <View style={styles.section}>
        <ThemedText type="caption">{t('budget.detail.noRecurring')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{t('budget.detail.recurring')}</ThemedText>
      {definitions.map((definition, index) => {
        const { rollingAverageAmount } = definition.budgetRecommendation;
        return (
          <View key={definition.id} style={styles.recurringItem}>
            <View style={styles.recurringRow}>
              <View style={styles.recurringMain}>
                <ThemedText type="small">{definition.name}</ThemedText>
                {/* A pending recommendation's badge already states the
                    average, so the plain average line would repeat it. */}
                {!isRecommendationPending(definition.budgetRecommendation) && (
                  <ThemedText type="caption">
                    {rollingAverageAmount === null
                      ? t('budget.noHistoryYet')
                      : t('budget.recurringAverage', { amount: format(rollingAverageAmount) })}
                  </ThemedText>
                )}
              </View>
              {/* definition.amount is in its own currency — convert before
                  formatting in the default currency (same as the badge). */}
              <ThemedText type="small">{format(definition.amount * definition.exchangeRateToDefault)}</ThemedText>
            </View>
            <BudgetRecommendationBadge definition={definition} />
            {index < definitions.length - 1 && <Divider />}
          </View>
        );
      })}
      <ThemedText type="caption">{t('budget.detail.editInExpenses')}</ThemedText>
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
    alignItems: 'center',
    gap: Spacing.two,
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
  // Sections are visually separated by spacing alone; each section's own
  // `gap` handles the spacing inside it.
  detail: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  recurringItem: {
    gap: Spacing.two,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  recurringMain: {
    flex: 1,
    gap: Spacing.half,
  },
});
