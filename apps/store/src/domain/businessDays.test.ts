import { describe, expect, it } from 'vitest';
import { lastBusinessDays, toBusinessDate } from './businessDays';

describe('business days (Asia/Seoul)', () => {
  it('rolls over at 00:00 KST, which is 15:00 UTC', () => {
    expect(toBusinessDate(Date.parse('2026-11-05T14:59:59Z'))).toBe('2026-11-05');
    expect(toBusinessDate(Date.parse('2026-11-05T15:00:00Z'))).toBe('2026-11-06');
  });
  it('spans the last 7 days including today, across a month end', () => {
    expect(lastBusinessDays(Date.parse('2026-11-03T01:00:00Z'))).toEqual({
      from: '2026-10-28',
      to: '2026-11-03',
    });
  });
});
