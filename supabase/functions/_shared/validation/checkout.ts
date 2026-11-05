import { z } from 'zod';

import {
  CART_MAX_LINES,
  LINE_MAX_QUANTITY,
  ORDER_NOTE_MAX_LENGTH,
  REJECT_REASON_MAX_LENGTH,
} from './limits.ts';

export const orderTypeSchema = z.enum(['DINE_IN', 'TAKEOUT']);
export const checkoutPaymentMethodSchema = z.enum(['KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY', 'CARD']);
export const rejectReasonCodeSchema = z.enum(['SOLD_OUT', 'CLOSING', 'TOO_BUSY', 'OTHER']);
export const testPgScenarioSchema = z.enum([
  'SUCCESS',
  'FAIL',
  'CANCEL',
  'SUCCESS_WEBHOOK_ONLY',
  'SUCCESS_DUPLICATE_WEBHOOK',
  'SUCCESS_LATE',
  'AMOUNT_MISMATCH',
]);

export const checkoutLineSchema = z.strictObject({
  menuItemId: z.uuid(),
  temperature: z.enum(['HOT', 'ICE']).nullable(),
  quantity: z.number().int().min(1).max(LINE_MAX_QUANTITY),
});

/**
 * Body of `payments-checkout`. Strict on purpose: the client never sends prices or totals, so any extra field
 * (for example `unitPrice`) is rejected instead of silently ignored.
 */
export const checkoutRequestSchema = z.strictObject({
  clientRequestId: z.uuid(),
  orderType: orderTypeSchema,
  lines: z.array(checkoutLineSchema).min(1).max(CART_MAX_LINES),
  userCouponId: z.uuid().nullable(),
  pointsToUse: z.number().int().min(0),
  paymentMethod: checkoutPaymentMethodSchema,
  note: z.string().trim().max(ORDER_NOTE_MAX_LENGTH).nullable(),
});

export const paymentConfirmRequestSchema = z.strictObject({
  paymentId: z.uuid(),
  providerPaymentKey: z.string().min(1).max(200),
});

export const paymentStatusRequestSchema = z.union([
  z.strictObject({ paymentId: z.uuid() }),
  z.strictObject({ orderId: z.uuid() }),
]);

export const refundRequestSchema = z.strictObject({ orderId: z.uuid() });

export const testPgRequestSchema = z.strictObject({
  checkoutToken: z.string().min(1).max(500),
  scenario: testPgScenarioSchema,
});

/** Reject form: `OTHER` needs a written reason, the listed codes do not. */
export const rejectOrderSchema = z
  .strictObject({
    reasonCode: rejectReasonCodeSchema,
    reason: z.string().trim().max(REJECT_REASON_MAX_LENGTH),
  })
  .refine((value) => value.reasonCode !== 'OTHER' || value.reason !== '', {
    path: ['reason'],
    message: '기타 사유를 입력해 주세요.',
  });

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutLineInput = z.infer<typeof checkoutLineSchema>;
export type PaymentConfirmRequest = z.infer<typeof paymentConfirmRequestSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
