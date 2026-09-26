import { validateCategoryForm } from './category-validation';

const base = { name: 'Salud', monthlyBudget: '', type: 'expense' as const };

describe('validateCategoryForm', () => {
  it('accepts a valid new category', () => {
    expect(validateCategoryForm(base, ['Casa'])).toBeNull();
  });

  it('requires a non-blank name', () => {
    expect(validateCategoryForm({ ...base, name: '   ' }, [])).toBe('nameRequired');
  });

  it('rejects a name another category already uses, ignoring case, accents and spaces', () => {
    expect(validateCategoryForm({ ...base, name: ' salud ' }, ['Salud'])).toBe('duplicateName');
    expect(validateCategoryForm({ ...base, name: 'Educacion' }, ['Educación'])).toBe(
      'duplicateName',
    );
  });

  it('rejects a negative budget', () => {
    expect(validateCategoryForm({ ...base, monthlyBudget: '-5' }, [])).toBe('negativeBudget');
  });

  it('accepts a blank, zero or non-numeric budget (D1 treats them as no budget)', () => {
    expect(validateCategoryForm({ ...base, monthlyBudget: '' }, [])).toBeNull();
    expect(validateCategoryForm({ ...base, monthlyBudget: '0' }, [])).toBeNull();
    expect(validateCategoryForm({ ...base, monthlyBudget: 'abc' }, [])).toBeNull();
  });

  it('ignores the budget for an income category', () => {
    expect(validateCategoryForm({ ...base, type: 'income', monthlyBudget: '-5' }, [])).toBeNull();
  });
});
