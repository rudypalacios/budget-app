import { categoryDisplayName } from './category-display';

describe('categoryDisplayName', () => {
  it('prefixes the name with the icon when one is set', () => {
    expect(categoryDisplayName({ name: 'Groceries', icon: '🛒' })).toBe('🛒 Groceries');
  });

  it('returns the plain name when icon is null', () => {
    expect(categoryDisplayName({ name: 'Rent', icon: null })).toBe('Rent');
  });

  it('returns an empty string for an undefined/null category (unresolved categoryId lookup)', () => {
    expect(categoryDisplayName(undefined)).toBe('');
    expect(categoryDisplayName(null)).toBe('');
  });
});
