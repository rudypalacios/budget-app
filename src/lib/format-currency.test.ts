import { formatCurrency } from './format-currency';
import i18n from '@/localization/i18n';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('formatCurrency', () => {
  it('formats with the currency symbol and English grouping/decimal style', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency(1234567.5, 'USD')).toBe('$ 1,234,567.50');
  });

  it('formats with Spanish grouping/decimal style when the language is Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(formatCurrency(1234567.5, 'USD')).toBe('$ 1.234.567,50');
  });

  it('looks up the right symbol per currency', () => {
    expect(formatCurrency(10, 'GTQ')).toBe('Q 10.00');
    expect(formatCurrency(10, 'EUR')).toBe('€ 10.00');
  });

  it('falls back to the raw code for an unsupported currency', () => {
    expect(formatCurrency(10, 'XYZ')).toBe('XYZ  10.00');
  });
});
