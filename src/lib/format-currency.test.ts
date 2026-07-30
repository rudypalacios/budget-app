import { formatCurrency } from './format-currency';
import i18n from '@/localization/i18n';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('formatCurrency', () => {
  it('formats USD with its own English-style grouping/decimal, regardless of UI language', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency(1234567.5, 'USD')).toBe('$ 1,234,567.50');
    await i18n.changeLanguage('es');
    expect(formatCurrency(1234567.5, 'USD')).toBe('$ 1,234,567.50');
  });

  it('formats EUR with its own Spanish-style grouping/decimal, regardless of UI language', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency(1234567.5, 'EUR')).toBe('€ 1.234.567,50');
    await i18n.changeLanguage('es');
    expect(formatCurrency(1234567.5, 'EUR')).toBe('€ 1.234.567,50');
  });

  it('formats GTQ with its own English-style grouping/decimal, regardless of UI language', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency(1234567.5, 'GTQ')).toBe('Q 1,234,567.50');
    await i18n.changeLanguage('es');
    expect(formatCurrency(1234567.5, 'GTQ')).toBe('Q 1,234,567.50');
  });

  it('looks up the right symbol per currency', () => {
    expect(formatCurrency(10, 'GTQ')).toBe('Q 10.00');
    expect(formatCurrency(10, 'EUR')).toBe('€ 10,00');
  });

  it('falls back to the raw code and the current UI language for an unsupported currency', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency(1234.5, 'XYZ')).toBe('XYZ  1,234.50');
    await i18n.changeLanguage('es');
    expect(formatCurrency(1234.5, 'XYZ')).toBe('XYZ  1234,50');
  });
});
