import { describe, expect, it } from 'vitest';

import { isNetworkError } from './networkError';

describe('isNetworkError', () => {
  it.each([
    { message: 'TypeError: Network request failed' },
    { message: 'TypeError: Failed to fetch' },
    new Error('fetch failed'),
    { message: 'The request timed out' },
  ])('recognizes a connection failure: %o', (error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  it.each([{ message: 'FORBIDDEN', code: 'P0001' }, { message: 'JWT expired' }, null, 'text', {}])(
    'does not treat a server refusal as a connection failure: %o',
    (error) => {
      expect(isNetworkError(error)).toBe(false);
    },
  );
});
