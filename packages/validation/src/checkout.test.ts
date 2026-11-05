import { describe, expect, it } from 'vitest';

import {
  checkoutRequestSchema,
  paymentConfirmRequestSchema,
  paymentStatusRequestSchema,
  rejectOrderSchema,
  testPgRequestSchema,
} from './checkout';

const ITEM = '00000000-0000-4000-8000-000000000201';
const REQUEST_ID = 'a0000000-0000-4000-8000-000000000001';

const validRequest = {
  clientRequestId: REQUEST_ID,
  orderType: 'TAKEOUT',
  lines: [{ menuItemId: ITEM, temperature: 'HOT', quantity: 2 }],
  userCouponId: null,
  pointsToUse: 0,
  paymentMethod: 'CARD',
  note: null,
};

describe('checkoutRequestSchema', () => {
  it('accepts a well-formed request', () => {
    expect(checkoutRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('accepts an item without a temperature choice', () => {
    const lines = [{ menuItemId: ITEM, temperature: null, quantity: 1 }];
    expect(checkoutRequestSchema.safeParse({ ...validRequest, lines }).success).toBe(true);
  });

  it('rejects client-sent prices and totals (the server prices every order)', () => {
    const withPrice = {
      ...validRequest,
      lines: [{ menuItemId: ITEM, temperature: 'HOT', quantity: 1, unitPrice: 1 }],
    };
    expect(checkoutRequestSchema.safeParse(withPrice).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...validRequest, total: 1 }).success).toBe(false);
  });

  it.each([
    ['empty cart', { lines: [] }],
    ['quantity 0', { lines: [{ menuItemId: ITEM, temperature: 'HOT', quantity: 0 }] }],
    ['quantity 21', { lines: [{ menuItemId: ITEM, temperature: 'HOT', quantity: 21 }] }],
    ['fractional quantity', { lines: [{ menuItemId: ITEM, temperature: 'HOT', quantity: 1.5 }] }],
    ['unknown temperature', { lines: [{ menuItemId: ITEM, temperature: 'WARM', quantity: 1 }] }],
    ['payment method NONE', { paymentMethod: 'NONE' }],
    ['negative points', { pointsToUse: -1 }],
    ['note over 100 characters', { note: '가'.repeat(101) }],
    ['not a uuid', { clientRequestId: 'abc' }],
  ])('rejects %s', (_label, override) => {
    expect(checkoutRequestSchema.safeParse({ ...validRequest, ...override }).success).toBe(false);
  });
});

describe('payment request schemas', () => {
  it('confirm needs a payment id and a provider key', () => {
    expect(
      paymentConfirmRequestSchema.safeParse({ paymentId: REQUEST_ID, providerPaymentKey: 'k' })
        .success,
    ).toBe(true);
    expect(
      paymentConfirmRequestSchema.safeParse({ paymentId: REQUEST_ID, providerPaymentKey: '' })
        .success,
    ).toBe(false);
  });

  it('status takes a payment id or an order id, not both or neither', () => {
    expect(paymentStatusRequestSchema.safeParse({ paymentId: REQUEST_ID }).success).toBe(true);
    expect(paymentStatusRequestSchema.safeParse({ orderId: REQUEST_ID }).success).toBe(true);
    expect(paymentStatusRequestSchema.safeParse({}).success).toBe(false);
    expect(
      paymentStatusRequestSchema.safeParse({ orderId: REQUEST_ID, paymentId: REQUEST_ID }).success,
    ).toBe(false);
  });

  it('test sheet accepts only known scenarios', () => {
    expect(testPgRequestSchema.safeParse({ checkoutToken: 't', scenario: 'SUCCESS' }).success).toBe(
      true,
    );
    expect(testPgRequestSchema.safeParse({ checkoutToken: 't', scenario: 'BOOM' }).success).toBe(
      false,
    );
  });
});

describe('rejectOrderSchema', () => {
  it('needs written text only for OTHER', () => {
    expect(rejectOrderSchema.safeParse({ reasonCode: 'SOLD_OUT', reason: '' }).success).toBe(true);
    expect(rejectOrderSchema.safeParse({ reasonCode: 'OTHER', reason: '  ' }).success).toBe(false);
    expect(rejectOrderSchema.safeParse({ reasonCode: 'OTHER', reason: '재료 소진' }).success).toBe(
      true,
    );
  });
});
