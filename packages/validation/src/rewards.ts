import { z } from 'zod';

import {
  COUPON_DISCOUNT_MAX,
  COUPON_REQUIRED_STAMPS_MAX,
  COUPON_TITLE_MAX_LENGTH,
  COUPON_VALID_DAYS_MAX,
  MIN_AMOUNT_PER_STAMP,
  STAMPS_PER_ORDER_MAX,
} from './limits';

/** `redeem_stamps_for_coupon` arguments: one client request id per tap keeps a retry from exchanging twice. */
export const stampExchangeSchema = z.strictObject({
  couponId: z.uuid(),
  clientRequestId: z.uuid(),
});

/**
 * Stamp policy form. The earn timing is not an input: the approved rule fixes it at COMPLETED (OQ-24).
 * PER_ORDER gives a fixed number of stamps per order, PER_AMOUNT one stamp per `amountPerStamp` won.
 */
export const stampPolicySchema = z.discriminatedUnion('earnMode', [
  z.strictObject({
    earnMode: z.literal('PER_ORDER'),
    stampsPerOrder: z.number().int().min(1).max(STAMPS_PER_ORDER_MAX),
  }),
  z.strictObject({
    earnMode: z.literal('PER_AMOUNT'),
    amountPerStamp: z
      .number()
      .int()
      .min(
        MIN_AMOUNT_PER_STAMP,
        `${MIN_AMOUNT_PER_STAMP.toLocaleString('ko-KR')}원 이상의 숫자로 입력해 주세요.`,
      ),
  }),
]);

/**
 * Exchange rule form (coupon definition). FREE_ITEM discounts one eligible unit price up to the optional cap;
 * FIXED_AMOUNT takes a fixed won amount off. Eligible categories / items are kept as they are when a rule is edited.
 */
export const exchangeRuleSchema = z
  .strictObject({
    title: z
      .string()
      .trim()
      .min(1, '쿠폰 이름을 입력해 주세요.')
      .max(
        COUPON_TITLE_MAX_LENGTH,
        `쿠폰 이름을 ${COUPON_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`,
      ),
    requiredStamps: z
      .number()
      .int()
      .min(1, `1~${COUPON_REQUIRED_STAMPS_MAX} 사이의 숫자로 입력해 주세요.`)
      .max(
        COUPON_REQUIRED_STAMPS_MAX,
        `1~${COUPON_REQUIRED_STAMPS_MAX} 사이의 숫자로 입력해 주세요.`,
      ),
    validDays: z
      .number()
      .int()
      .min(1, `1~${COUPON_VALID_DAYS_MAX}일 사이로 입력해 주세요.`)
      .max(COUPON_VALID_DAYS_MAX, `1~${COUPON_VALID_DAYS_MAX}일 사이로 입력해 주세요.`),
    benefitType: z.enum(['FIXED_AMOUNT', 'FREE_ITEM']),
    discountAmount: z.number().int().min(1).max(COUPON_DISCOUNT_MAX).nullable(),
  })
  .refine((rule) => rule.benefitType !== 'FIXED_AMOUNT' || rule.discountAmount !== null, {
    path: ['discountAmount'],
    message: '할인 금액을 입력해 주세요.',
  });

export type StampExchangeInput = z.infer<typeof stampExchangeSchema>;
export type StampPolicyInput = z.infer<typeof stampPolicySchema>;
export type ExchangeRuleInput = z.infer<typeof exchangeRuleSchema>;
