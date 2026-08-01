import { ExchangeRateFetchError, fetchExchangeRate } from './exchange-rate';

describe('fetchExchangeRate', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the rate for the target currency on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: { GTQ: 7.62, EUR: 0.87 } }),
    }) as unknown as typeof fetch;

    await expect(fetchExchangeRate('USD', 'GTQ')).resolves.toBe(7.62);
  });

  it('throws when the target currency is missing from the response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: { EUR: 0.87 } }),
    }) as unknown as typeof fetch;

    await expect(fetchExchangeRate('USD', 'GTQ')).rejects.toBeInstanceOf(ExchangeRateFetchError);
  });

  it('throws when the provider reports an unsuccessful result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'error', rates: {} }),
    }) as unknown as typeof fetch;

    await expect(fetchExchangeRate('USD', 'GTQ')).rejects.toBeInstanceOf(ExchangeRateFetchError);
  });

  it('throws when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(fetchExchangeRate('USD', 'GTQ')).rejects.toBeInstanceOf(ExchangeRateFetchError);
  });

  it('throws when the network request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await expect(fetchExchangeRate('USD', 'GTQ')).rejects.toBeInstanceOf(ExchangeRateFetchError);
  });
});
