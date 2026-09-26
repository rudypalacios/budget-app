import { normalizeSearchText } from './search-text';

describe('normalizeSearchText', () => {
  it('lowercases', () => {
    expect(normalizeSearchText('English')).toBe('english');
  });

  it('strips accents and diacritics', () => {
    expect(normalizeSearchText('Español')).toBe('espanol');
    expect(normalizeSearchText('Português')).toBe('portugues');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeSearchText('  esp ')).toBe('esp');
  });

  it('lets an unaccented query match an accented label', () => {
    expect(normalizeSearchText('Español').includes(normalizeSearchText('ESPAN'))).toBe(true);
  });
});
