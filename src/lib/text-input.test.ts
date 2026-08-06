import { trimName } from './text-input';

describe('trimName', () => {
  it('strips leading and trailing whitespace', () => {
    expect(trimName('  Groceries  ')).toBe('Groceries');
  });

  it('leaves internal whitespace between words untouched', () => {
    expect(trimName('  Coffee Shop  ')).toBe('Coffee Shop');
  });

  it('returns an empty string for a whitespace-only input', () => {
    expect(trimName('   ')).toBe('');
  });

  it('leaves an already-trimmed value unchanged', () => {
    expect(trimName('Rent')).toBe('Rent');
  });
});
