import { describe, expect, it } from 'vitest';
import { findPointCode, generateFixtureCode, totalPoints, validatePointIssue } from './pointCodes';
import { createPointCodes } from '@/data/fixtures/admin';

describe('point code helpers', () => {
  it('generates well-formed, distinct fixture codes', () => {
    const a = generateFixtureCode(1);
    expect(a).toMatch(/^OLIVE-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(generateFixtureCode(2)).not.toBe(a);
  });

  it('validates amount, quantity and a future expiry date', () => {
    const ok = validatePointIssue(
      { amountText: '5000', quantityText: '3', expiresOn: '2027-01-01', memo: ' 선물 ' },
      '2026-11-05',
    );
    expect(ok).toEqual({
      ok: true,
      amount: 5000,
      quantity: 3,
      expiresOn: '2027-01-01',
      memo: '선물',
    });
    const bad = validatePointIssue(
      { amountText: '10', quantityText: '0', expiresOn: '2026-11-05', memo: '' },
      '2026-11-05',
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(Object.keys(bad.errors).sort()).toEqual(['amount', 'expiresOn', 'quantity']);
  });

  it('looks codes up case-insensitively and returns null for unknown or empty input', () => {
    const codes = createPointCodes();
    expect(findPointCode(codes, ' olive-7k2m-9qxd ')?.amount).toBe(15000);
    expect(findPointCode(codes, 'OLIVE-0000-0000')).toBeNull();
    expect(findPointCode(codes, '  ')).toBeNull();
  });

  it('totals balances only for registered codes', () => {
    expect(totalPoints(createPointCodes())).toEqual({
      issued: 35000,
      used: 8000,
      remaining: 12000,
    });
  });
});
