import type { UseQueryResult } from '@tanstack/react-query';

import { toQueryState } from '@/lib/queryState';

/** Only the fields `toQueryState` reads. */
function result(partial: {
  data?: unknown;
  isError?: boolean;
  error?: unknown;
  fetchStatus?: string;
}) {
  return {
    data: partial.data,
    isError: partial.isError ?? false,
    error: partial.error ?? null,
    fetchStatus: partial.fetchStatus ?? 'idle',
    refetch: jest.fn(),
  } as unknown as UseQueryResult<unknown, unknown>;
}

describe('toQueryState', () => {
  it('is loading until the first response', () => {
    expect(toQueryState(result({}))).toEqual({ status: 'loading' });
  });

  it('returns the data once loaded, including a legitimate null (item not found)', () => {
    expect(toQueryState(result({ data: [1] }))).toEqual({ status: 'success', data: [1] });
    expect(toQueryState(result({ data: null }))).toEqual({ status: 'success', data: null });
  });

  it('keeps showing data when a background refetch fails', () => {
    expect(toQueryState(result({ data: [1], isError: true, error: new Error('x') })).status).toBe(
      'success',
    );
  });

  it('is offline when NetInfo reports no connection (query paused), and retry refetches', () => {
    const query = result({ fetchStatus: 'paused' });
    const state = toQueryState(query);
    expect(state.status).toBe('offline');
    if (state.status === 'offline') state.refetch();
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing data while paused offline', () => {
    expect(toQueryState(result({ data: [1], fetchStatus: 'paused' })).status).toBe('success');
  });

  it('is not offline for a failed request while the connection is up', () => {
    const state = toQueryState(
      result({ isError: true, error: { message: 'TypeError: Network request failed' } }),
    );
    expect(state.status).toBe('error');
  });

  it('is an error for a server refusal', () => {
    const state = toQueryState(result({ isError: true, error: { message: 'FORBIDDEN' } }));
    expect(state.status).toBe('error');
  });
});
