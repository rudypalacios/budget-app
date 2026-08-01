// Mocks first — same idiom as user-settings.test.ts.
/* eslint-disable import/first */
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('@/lib/firebase/firestore', () => ({
  firestoreClient: {
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    getDoc: jest.fn(),
    addDoc: jest.fn(),
    batchUpdate: jest.fn(),
    getDocs: jest.fn(),
    subscribeDoc: jest.fn(),
    subscribeCollection: jest.fn().mockReturnValue(() => {}),
  },
}));

import {
  addCurrency,
  getConfiguredRate,
  removeCurrency,
  subscribeCurrencies,
  updateCurrencyRate,
  useCurrenciesStore,
} from './currencies';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeCurrencies('test-uid');
});

beforeEach(() => {
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  useCurrenciesStore.setState({ items: [], isLoading: false, error: null, fromCache: false, hasPendingWrites: false });
});

describe('addCurrency', () => {
  it('writes a doc at the deterministic code-as-ID path with status "ok"', async () => {
    await addCurrency('EUR', 8.78, 'fetched');

    expect(mockSetDoc).toHaveBeenCalledWith('users/test-uid/currencies/EUR', {
      exchangeRateToDefault: 8.78,
      rateSource: 'fetched',
      status: 'ok',
    });
  });
});

describe('updateCurrencyRate', () => {
  it('clears a stale status back to "ok" alongside the new rate', async () => {
    await updateCurrencyRate('EUR', 9.01, 'manual');

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/currencies/EUR', {
      exchangeRateToDefault: 9.01,
      rateSource: 'manual',
      status: 'ok',
    });
  });
});

describe('removeCurrency', () => {
  it('deletes the doc at the code-as-ID path', async () => {
    await removeCurrency('EUR');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/currencies/EUR');
  });
});

describe('getConfiguredRate', () => {
  it('returns rate 1 / manual for the default currency without consulting the store', () => {
    expect(getConfiguredRate('GTQ', 'GTQ')).toEqual({ exchangeRateToDefault: 1, rateSource: 'manual' });
  });

  it('returns the configured rate for an added currency', () => {
    useCurrenciesStore.setState({
      items: [
        {
          id: 'EUR',
          exchangeRateToDefault: 8.78,
          rateSource: 'fetched',
          status: 'ok',
        } as never,
      ],
    });

    expect(getConfiguredRate('EUR', 'GTQ')).toEqual({ exchangeRateToDefault: 8.78, rateSource: 'fetched' });
  });

  it('falls back to 1 / manual for a currency not found in the store (e.g. removed between render and submit)', () => {
    expect(getConfiguredRate('USD', 'GTQ')).toEqual({ exchangeRateToDefault: 1, rateSource: 'manual' });
  });
});
