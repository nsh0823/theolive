import { describe, expect, it } from 'vitest';
import { APP_ERROR, APP_ERROR_MESSAGE, isAppErrorCode, toAppErrorCode } from './errors';

describe('app errors', () => {
  it('has a user-facing message for every code', () => {
    for (const code of Object.values(APP_ERROR)) {
      expect(APP_ERROR_MESSAGE[code].length).toBeGreaterThan(0);
    }
  });

  it('recognises only known codes', () => {
    expect(isAppErrorCode('LAST_ADMIN')).toBe(true);
    expect(isAppErrorCode('NOPE')).toBe(false);
    expect(isAppErrorCode(42)).toBe(false);
    expect(isAppErrorCode(null)).toBe(false);
  });

  it('reads the code from a PostgREST error message', () => {
    expect(toAppErrorCode({ code: 'P0001', message: 'FORBIDDEN' })).toBe(APP_ERROR.FORBIDDEN);
  });

  it('reads the code from an Edge Function error body', () => {
    expect(toAppErrorCode({ code: 'ALREADY_STAFF', message: '이미 등록된 직원이에요.' })).toBe(
      APP_ERROR.ALREADY_STAFF,
    );
  });

  it('falls back to INTERNAL for unknown or malformed errors', () => {
    expect(toAppErrorCode({ code: '42501', message: 'permission denied' })).toBe(
      APP_ERROR.INTERNAL,
    );
    expect(toAppErrorCode('boom')).toBe(APP_ERROR.INTERNAL);
    expect(toAppErrorCode(null)).toBe(APP_ERROR.INTERNAL);
  });
});
