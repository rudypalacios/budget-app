import type {
  ExpenseRecord,
  IncomeRecord,
  RecurringExpense,
  RecurringIncome,
} from '@/types/firestore';

// Counts everything a user would consider "in this category" for the
// categories admin list's "(count · budget)" caption — active (not
// archived/trashed) one-time expenses/incomes plus active recurring
// expense/income definitions. Recurring *instances* aren't counted
// separately from their definition; the definition already represents the
// ongoing bill the user is browsing categories to check on.
export function countCategoryItems(
  categoryId: string,
  expenses: ExpenseRecord[],
  incomes: IncomeRecord[],
  recurringExpenses: RecurringExpense[],
  recurringIncomes: RecurringIncome[],
): number {
  const isActiveInCategory = (item: { categoryId: string; lifecycleState: string }) =>
    item.categoryId === categoryId && item.lifecycleState === 'active';

  const oneTimeExpenseCount = expenses.filter(
    (item) => item.kind === 'oneTime' && isActiveInCategory(item),
  ).length;
  const oneTimeIncomeCount = incomes.filter(
    (item) => item.kind === 'oneTime' && isActiveInCategory(item),
  ).length;
  const recurringExpenseCount = recurringExpenses.filter(isActiveInCategory).length;
  const recurringIncomeCount = recurringIncomes.filter(isActiveInCategory).length;

  return oneTimeExpenseCount + oneTimeIncomeCount + recurringExpenseCount + recurringIncomeCount;
}
