import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  POINT_AMOUNT_MAX,
  POINT_AMOUNT_MIN,
  POINT_MAX_PER_ORDER_MAX,
  POINT_MEMO_MAX_LENGTH,
  POINT_MIN_USE_MAX,
  POINT_QUANTITY_MAX,
  POINT_USE_UNIT_MAX,
} from './limits';
import { pointCodeInputSchema, pointIssueSchema, pointPolicySchema } from './points';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');
const migrationsSql = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n');

describe('coupon point limits match the SQL check constraints', () => {
  it('batch and code limits', () => {
    expect(migrationsSql).toContain(`amount between ${POINT_AMOUNT_MIN} and ${POINT_AMOUNT_MAX}`);
    expect(migrationsSql).toContain(`quantity between 1 and ${POINT_QUANTITY_MAX}`);
    expect(migrationsSql).toContain(`char_length(memo) <= ${POINT_MEMO_MAX_LENGTH}`);
  });
  it('policy limits', () => {
    expect(migrationsSql).toContain(`min_use_amount between 0 and ${POINT_MIN_USE_MAX}`);
    expect(migrationsSql).toContain(`use_unit between 1 and ${POINT_USE_UNIT_MAX}`);
    expect(migrationsSql).toContain(`max_use_per_order between 1 and ${POINT_MAX_PER_ORDER_MAX}`);
  });
});

describe('pointCodeInputSchema', () => {
  it('trims and upper-cases', () => {
    expect(pointCodeInputSchema.parse('  olive-ab23-cd45 ')).toBe('OLIVE-AB23-CD45');
  });
  it('rejects blank and very long input', () => {
    expect(pointCodeInputSchema.safeParse('   ').success).toBe(false);
    expect(pointCodeInputSchema.safeParse('x'.repeat(41)).success).toBe(false);
  });
});

describe('pointIssueSchema', () => {
  const valid = { amount: 5000, quantity: 3, expiresOn: '2027-01-01', memo: ' 선물 ' };
  it('accepts the limits themselves and trims the memo', () => {
    expect(pointIssueSchema.parse(valid).memo).toBe('선물');
    expect(pointIssueSchema.safeParse({ ...valid, amount: POINT_AMOUNT_MIN }).success).toBe(true);
    expect(pointIssueSchema.safeParse({ ...valid, amount: POINT_AMOUNT_MAX }).success).toBe(true);
    expect(pointIssueSchema.safeParse({ ...valid, quantity: POINT_QUANTITY_MAX }).success).toBe(
      true,
    );
  });
  it.each([
    ['amount below', { amount: POINT_AMOUNT_MIN - 1 }],
    ['amount above', { amount: POINT_AMOUNT_MAX + 1 }],
    ['fractional amount', { amount: 1500.5 }],
    ['zero quantity', { quantity: 0 }],
    ['quantity above', { quantity: POINT_QUANTITY_MAX + 1 }],
    ['date shape', { expiresOn: '2027/01/01' }],
    ['memo too long', { memo: 'a'.repeat(POINT_MEMO_MAX_LENGTH + 1) }],
  ])('rejects %s', (_label, override) => {
    expect(pointIssueSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('pointPolicySchema', () => {
  it('accepts no cap and rejects out-of-range rules', () => {
    expect(
      pointPolicySchema.safeParse({ minUseAmount: 0, useUnit: 1, maxUsePerOrder: null }).success,
    ).toBe(true);
    expect(
      pointPolicySchema.safeParse({ minUseAmount: -1, useUnit: 1, maxUsePerOrder: null }).success,
    ).toBe(false);
    expect(
      pointPolicySchema.safeParse({ minUseAmount: 0, useUnit: 0, maxUsePerOrder: null }).success,
    ).toBe(false);
    expect(
      pointPolicySchema.safeParse({ minUseAmount: 0, useUnit: 1, maxUsePerOrder: 0 }).success,
    ).toBe(false);
  });
});
