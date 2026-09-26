import { countPendingRecordsInCurrency } from './currency-usage';
import type { WithId } from '@/lib/firebase/firestore.types';
import type { ExpenseRecord, IncomeRecord } from '@/types/firestore';

function expense(overrides: Partial<Record<string, unknown>>): WithId<ExpenseRecord> {
  return {
    id: 'e',
    kind: 'oneTime',
    currency: 'USD',
    lifecycleState: 'active',
    paid: false,
    ...overrides,
  } as unknown as WithId<ExpenseRecord>;
}

function income(overrides: Partial<Record<string, unknown>>): WithId<IncomeRecord> {
  return {
    id: 'i',
    currency: 'USD',
    lifecycleState: 'active',
    paid: false,
    ...overrides,
  } as unknown as WithId<IncomeRecord>;
}

describe('countPendingRecordsInCurrency', () => {
  it('counts unpaid active expenses and incomes in that currency', () => {
    expect(
      countPendingRecordsInCurrency('USD', [expense({}), expense({ id: 'e2' })], [income({})]),
    ).toBe(3);
  });

  it('ignores records in other currencies', () => {
    expect(countPendingRecordsInCurrency('USD', [expense({ currency: 'GTQ' })], [])).toBe(0);
  });

  it('ignores paid records, since their rate is already fixed', () => {
    expect(
      countPendingRecordsInCurrency('USD', [expense({ paid: true })], [income({ paid: true })]),
    ).toBe(0);
  });

  it('ignores skipped recurring instances', () => {
    expect(
      countPendingRecordsInCurrency(
        'USD',
        [expense({ kind: 'recurringInstance', skipped: true })],
        [],
      ),
    ).toBe(0);
  });

  it('ignores archived and trashed records', () => {
    expect(
      countPendingRecordsInCurrency(
        'USD',
        [expense({ lifecycleState: 'archived' })],
        [income({ lifecycleState: 'trashed' })],
      ),
    ).toBe(0);
  });
});
