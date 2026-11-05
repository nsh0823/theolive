import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  COUPON_DISCOUNT_MAX,
  COUPON_REQUIRED_STAMPS_MAX,
  COUPON_TITLE_MAX_LENGTH,
  COUPON_VALID_DAYS_MAX,
  MIN_AMOUNT_PER_STAMP,
  STAMPS_PER_ORDER_MAX,
} from './limits';
import { exchangeRuleSchema, stampExchangeSchema, stampPolicySchema } from './rewards';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');
const migrationsSql = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n');

const UUID = '00000000-0000-4000-8000-000000000001';

describe('reward limits match the SQL check constraints', () => {
  it('coupon rule limits', () => {
    expect(migrationsSql).toContain(`char_length(title) between 1 and ${COUPON_TITLE_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`required_stamps between 1 and ${COUPON_REQUIRED_STAMPS_MAX}`);
    expect(migrationsSql).toContain(`valid_days between 1 and ${COUPON_VALID_DAYS_MAX}`);
    expect(migrationsSql).toContain(`discount_amount <= ${COUPON_DISCOUNT_MAX}`);
  });
  it('stamp policy limits', () => {
    expect(migrationsSql).toContain(`stamps_per_order between 1 and ${STAMPS_PER_ORDER_MAX}`);
    expect(migrationsSql).toContain(`amount_per_stamp >= ${MIN_AMOUNT_PER_STAMP}`);
  });
});

describe('stampExchangeSchema', () => {
  it('needs two uuids', () => {
    expect(stampExchangeSchema.safeParse({ couponId: UUID, clientRequestId: UUID }).success).toBe(
      true,
    );
    expect(stampExchangeSchema.safeParse({ couponId: 'x', clientRequestId: UUID }).success).toBe(
      false,
    );
  });
  it('rejects extra fields such as a client-sent cost', () => {
    expect(
      stampExchangeSchema.safeParse({ couponId: UUID, clientRequestId: UUID, cost: 0 }).success,
    ).toBe(false);
  });
});

describe('stampPolicySchema', () => {
  it('accepts a per-order policy within the limits', () => {
    expect(stampPolicySchema.safeParse({ earnMode: 'PER_ORDER', stampsPerOrder: 1 }).success).toBe(
      true,
    );
    expect(
      stampPolicySchema.safeParse({ earnMode: 'PER_ORDER', stampsPerOrder: STAMPS_PER_ORDER_MAX })
        .success,
    ).toBe(true);
  });
  it('rejects zero, too many, and fractional stamps', () => {
    for (const stampsPerOrder of [0, STAMPS_PER_ORDER_MAX + 1, 1.5]) {
      expect(stampPolicySchema.safeParse({ earnMode: 'PER_ORDER', stampsPerOrder }).success).toBe(
        false,
      );
    }
  });
  it('requires the minimum won per stamp for a per-amount policy', () => {
    expect(
      stampPolicySchema.safeParse({ earnMode: 'PER_AMOUNT', amountPerStamp: MIN_AMOUNT_PER_STAMP })
        .success,
    ).toBe(true);
    expect(
      stampPolicySchema.safeParse({
        earnMode: 'PER_AMOUNT',
        amountPerStamp: MIN_AMOUNT_PER_STAMP - 1,
      }).success,
    ).toBe(false);
  });
  it('has no earn timing input (OQ-24)', () => {
    expect(
      stampPolicySchema.safeParse({
        earnMode: 'PER_ORDER',
        stampsPerOrder: 1,
        earnTiming: 'PAID',
      }).success,
    ).toBe(false);
  });
});

describe('exchangeRuleSchema', () => {
  const base = {
    title: '아메리카노 쿠폰',
    requiredStamps: 10,
    validDays: 90,
    benefitType: 'FREE_ITEM',
    discountAmount: null,
  };
  it('accepts a free-item rule without a cap', () => {
    expect(exchangeRuleSchema.safeParse(base).success).toBe(true);
  });
  it('trims the title and rejects an empty or long one', () => {
    expect(exchangeRuleSchema.parse({ ...base, title: '  쿠폰  ' }).title).toBe('쿠폰');
    expect(exchangeRuleSchema.safeParse({ ...base, title: '   ' }).success).toBe(false);
    expect(
      exchangeRuleSchema.safeParse({ ...base, title: 'a'.repeat(COUPON_TITLE_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });
  it('bounds stamps, validity days and the cap', () => {
    expect(exchangeRuleSchema.safeParse({ ...base, requiredStamps: 0 }).success).toBe(false);
    expect(
      exchangeRuleSchema.safeParse({ ...base, requiredStamps: COUPON_REQUIRED_STAMPS_MAX + 1 })
        .success,
    ).toBe(false);
    expect(
      exchangeRuleSchema.safeParse({ ...base, validDays: COUPON_VALID_DAYS_MAX + 1 }).success,
    ).toBe(false);
    expect(
      exchangeRuleSchema.safeParse({ ...base, discountAmount: COUPON_DISCOUNT_MAX + 1 }).success,
    ).toBe(false);
  });
  it('needs an amount for a fixed-amount rule', () => {
    expect(
      exchangeRuleSchema.safeParse({ ...base, benefitType: 'FIXED_AMOUNT', discountAmount: null })
        .success,
    ).toBe(false);
    expect(
      exchangeRuleSchema.safeParse({ ...base, benefitType: 'FIXED_AMOUNT', discountAmount: 3000 })
        .success,
    ).toBe(true);
  });
});
