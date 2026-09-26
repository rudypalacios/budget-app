import { parseAmountInput } from '@/lib/currency-input';
import { normalizeSearchText } from '@/lib/search-text';

export type CategoryFormError = 'nameRequired' | 'duplicateName' | 'negativeBudget';

export type CategoryFormInput = {
  name: string;
  // Raw text from the budget field ('' = no budget).
  monthlyBudget: string;
  // Income categories carry no budget, so the field isn't checked for them.
  type: 'expense' | 'income' | 'both';
};

// Checked on Save in the category form (Ajustes redesign, ajustes-v2
// prototype). `otherNames` are every other category's name — active and
// archived alike, since an archived one can be reactivated and would then
// clash. Names compare ignoring case, accents and surrounding spaces, so
// "Salud" and " salud" count as the same. A budget that isn't a number is
// deliberately not an error: D1 (Presupuesto redesign) already treats blank,
// 0 or non-numeric as "no budget".
export function validateCategoryForm(
  input: CategoryFormInput,
  otherNames: readonly string[],
): CategoryFormError | null {
  const name = normalizeSearchText(input.name);
  if (!name) return 'nameRequired';
  if (otherNames.some((other) => normalizeSearchText(other) === name)) return 'duplicateName';

  if (input.type !== 'income' && input.monthlyBudget.trim() !== '') {
    const budget = parseAmountInput(input.monthlyBudget);
    if (Number.isFinite(budget) && budget < 0) return 'negativeBudget';
  }
  return null;
}
