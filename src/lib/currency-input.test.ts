import { parseAmountInput, sanitizeAmountInput } from './currency-input';

describe('sanitizeAmountInput', () => {
  it('keeps digits, period, and comma', () => {
    expect(sanitizeAmountInput('12.34')).toBe('12.34');
    expect(sanitizeAmountInput('12,34')).toBe('12,34');
  });

  it('strips letters and currency symbols', () => {
    expect(sanitizeAmountInput('Q123.45')).toBe('123.45');
    expect(sanitizeAmountInput('$1a2b3c')).toBe('123');
  });

  it('strips whitespace and other punctuation', () => {
    expect(sanitizeAmountInput('1 234-56')).toBe('123456');
  });
});

describe('parseAmountInput', () => {
  it('parses a period-decimal amount', () => {
    expect(parseAmountInput('12.34')).toBe(12.34);
  });

  it('normalizes a comma-decimal amount to a period before parsing', () => {
    expect(parseAmountInput('12,34')).toBe(12.34);
  });

  it('returns NaN for a malformed value', () => {
    expect(parseAmountInput('12.34.56')).toBeNaN();
  });

  // Number('') is 0, not NaN — callers rely on the existing `parsedAmount >
  // 0` validity check (e.g. expense-form.tsx) to reject an empty amount,
  // not on NaN.
  it('parses an empty value as 0', () => {
    expect(parseAmountInput('')).toBe(0);
  });
});
