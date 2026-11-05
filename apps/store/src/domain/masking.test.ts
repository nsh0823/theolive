import { describe, expect, it } from 'vitest';
import { maskEmail, maskPhone } from './masking';

describe('maskEmail', () => {
  it('keeps four characters of a normal local part', () => {
    expect(maskEmail('honggildong@gmail.com')).toBe('hong***@gmail.com');
  });
  it('keeps only one character of short local parts', () => {
    expect(maskEmail('abcd@naver.com')).toBe('a***@naver.com');
    expect(maskEmail('a@x.kr')).toBe('a***@x.kr');
  });
  it('never returns the original for malformed input, and handles null', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('@gmail.com')).toBe('***');
    expect(maskEmail('user@')).toBe('***');
    expect(maskEmail(null)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks Korean mobile numbers in any common format', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskPhone('01012345678')).toBe('010-****-5678');
    expect(maskPhone('+82 10 1234 5678')).toBe('010-****-5678');
  });
  it('masks 10-digit numbers', () => {
    expect(maskPhone('011-234-5678')).toBe('011-***-5678');
  });
  it('shows only the last four digits of non-Korean numbers', () => {
    expect(maskPhone('+1 415 555 2671')).toBe('***-2671');
  });
  it('handles missing, empty and tiny values', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('  ')).toBeNull();
    expect(maskPhone('1234')).toBe('****');
  });
  it('never leaks the middle digits', () => {
    for (const input of ['010-9876-5432', '+821098765432', '+44 20 7946 0958']) {
      expect(maskPhone(input)).not.toMatch(/9876|7946/);
    }
  });
});
