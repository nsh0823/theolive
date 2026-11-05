import { z } from 'zod';

import {
  POINT_AMOUNT_MAX,
  POINT_AMOUNT_MIN,
  POINT_MAX_PER_ORDER_MAX,
  POINT_MEMO_MAX_LENGTH,
  POINT_MIN_USE_MAX,
  POINT_QUANTITY_MAX,
  POINT_USE_UNIT_MAX,
} from './limits';

const CODE_INPUT_MAX_LENGTH = 40;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/**
 * What a customer types for `register_coupon_point_code`. Only trimmed and upper-cased here; the server decides
 * whether the code exists, so a wrong-looking code is still sent (and counted by the brute-force limit).
 */
export const pointCodeInputSchema = z
  .string()
  .trim()
  .min(1, '코드를 입력해 주세요.')
  .max(CODE_INPUT_MAX_LENGTH, '올바르지 않은 코드예요. 코드를 다시 확인해 주세요.')
  .transform((value) => value.toUpperCase());

/** Admin batch issue form (`admin_issue_point_codes`). `expiresOn` is the last valid day, `YYYY-MM-DD`. */
export const pointIssueSchema = z.strictObject({
  amount: z
    .number()
    .int()
    .min(
      POINT_AMOUNT_MIN,
      `${won(POINT_AMOUNT_MIN)} 이상 ${won(POINT_AMOUNT_MAX)} 이하로 입력해 주세요.`,
    )
    .max(
      POINT_AMOUNT_MAX,
      `${won(POINT_AMOUNT_MIN)} 이상 ${won(POINT_AMOUNT_MAX)} 이하로 입력해 주세요.`,
    ),
  quantity: z
    .number()
    .int()
    .min(1, `1~${POINT_QUANTITY_MAX}개 사이로 입력해 주세요.`)
    .max(POINT_QUANTITY_MAX, `1~${POINT_QUANTITY_MAX}개 사이로 입력해 주세요.`),
  expiresOn: z.string().regex(DATE_KEY, '만료일을 선택해 주세요.'),
  memo: z
    .string()
    .trim()
    .max(POINT_MEMO_MAX_LENGTH, `메모는 ${POINT_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`),
});

/** Admin use rules (`coupon_point_policy`). `maxUsePerOrder` null means no cap. */
export const pointPolicySchema = z.strictObject({
  minUseAmount: z.number().int().min(0).max(POINT_MIN_USE_MAX),
  useUnit: z.number().int().min(1).max(POINT_USE_UNIT_MAX),
  maxUsePerOrder: z.number().int().min(1).max(POINT_MAX_PER_ORDER_MAX).nullable(),
});

export type PointIssueInput = z.infer<typeof pointIssueSchema>;
export type PointPolicyInput = z.infer<typeof pointPolicySchema>;
