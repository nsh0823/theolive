import type { Database } from './supabase';

type PublicEnums = Database['public']['Enums'];

/**
 * One const object per Postgres enum. The helper requires every enum value as a key mapped to itself and
 * rejects any extra key, so these cannot drift from the generated `supabase.ts`.
 */
function enumValues<E extends string>() {
  return <const T extends { readonly [K in E]: K }>(
    values: T & Record<Exclude<keyof T, E>, never>,
  ) => values;
}

export const TEMPERATURE = enumValues<PublicEnums['temperature']>()({ HOT: 'HOT', ICE: 'ICE' });

export const ORDER_TYPE = enumValues<PublicEnums['order_type']>()({
  DINE_IN: 'DINE_IN',
  TAKEOUT: 'TAKEOUT',
});

export const ORDER_STATUS = enumValues<PublicEnums['order_status']>()({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

export const PAYMENT_STATUS = enumValues<PublicEnums['payment_status']>()({
  READY: 'READY',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PARTIAL_REFUNDED: 'PARTIAL_REFUNDED',
  REFUNDED: 'REFUNDED',
});

export const PAYMENT_METHOD = enumValues<PublicEnums['payment_method']>()({
  KAKAO_PAY: 'KAKAO_PAY',
  NAVER_PAY: 'NAVER_PAY',
  TOSS_PAY: 'TOSS_PAY',
  CARD: 'CARD',
  NONE: 'NONE',
});

export const REFUND_STATUS = enumValues<PublicEnums['refund_status']>()({
  REQUESTED: 'REQUESTED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
});

export const ACTOR_ROLE = enumValues<PublicEnums['actor_role']>()({
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
});

export const STAFF_ROLE = enumValues<PublicEnums['staff_role']>()({
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
});

export const STAFF_PERMISSION = enumValues<PublicEnums['staff_permission']>()({
  PROCESS_ORDERS: 'PROCESS_ORDERS',
  MANAGE_OPERATIONS: 'MANAGE_OPERATIONS',
});

export const STAMP_EARN_MODE = enumValues<PublicEnums['stamp_earn_mode']>()({
  PER_ORDER: 'PER_ORDER',
  PER_AMOUNT: 'PER_AMOUNT',
});

export const STAMP_EARN_TIMING = enumValues<PublicEnums['stamp_earn_timing']>()({
  PAID: 'PAID',
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
});

export const STAMP_TX_KIND = enumValues<PublicEnums['stamp_tx_kind']>()({
  EARN: 'EARN',
  REDEEM: 'REDEEM',
  EARN_REVERSAL: 'EARN_REVERSAL',
  REDEEM_RESTORE: 'REDEEM_RESTORE',
  EXPIRE: 'EXPIRE',
  FORFEIT: 'FORFEIT',
  ADJUST: 'ADJUST',
});

export const COUPON_BENEFIT_TYPE = enumValues<PublicEnums['coupon_benefit_type']>()({
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  FREE_ITEM: 'FREE_ITEM',
});

export const USER_COUPON_STATUS = enumValues<PublicEnums['user_coupon_status']>()({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  VOID: 'VOID',
});

export const POINT_CODE_STATUS = enumValues<PublicEnums['point_code_status']>()({
  UNUSED: 'UNUSED',
  REGISTERED: 'REGISTERED',
  EXPIRED: 'EXPIRED',
  VOID: 'VOID',
});

export const POINT_TX_KIND = enumValues<PublicEnums['point_tx_kind']>()({
  REGISTER: 'REGISTER',
  USE: 'USE',
  REFUND_RESTORE: 'REFUND_RESTORE',
  EXPIRE: 'EXPIRE',
  FORFEIT: 'FORFEIT',
  ADJUST: 'ADJUST',
});

export const POINT_HOLD_STATUS = enumValues<PublicEnums['point_hold_status']>()({
  HELD: 'HELD',
  CAPTURED: 'CAPTURED',
  RELEASED: 'RELEASED',
});

export const NOTIFICATION_KIND = enumValues<PublicEnums['notification_kind']>()({
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  STAMP: 'STAMP',
  COUPON: 'COUPON',
  POINT: 'POINT',
  NOTICE: 'NOTICE',
});

export const ANNOUNCEMENT_STATUS = enumValues<PublicEnums['announcement_status']>()({
  PUBLISHED: 'PUBLISHED',
  UNPUBLISHED: 'UNPUBLISHED',
});

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUS)[keyof typeof ANNOUNCEMENT_STATUS];
export type Temperature = (typeof TEMPERATURE)[keyof typeof TEMPERATURE];
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];
export type StaffPermission = (typeof STAFF_PERMISSION)[keyof typeof STAFF_PERMISSION];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];
export type StampEarnMode = (typeof STAMP_EARN_MODE)[keyof typeof STAMP_EARN_MODE];
export type StampTxKind = (typeof STAMP_TX_KIND)[keyof typeof STAMP_TX_KIND];
export type CouponBenefitType = (typeof COUPON_BENEFIT_TYPE)[keyof typeof COUPON_BENEFIT_TYPE];
export type UserCouponStatus = (typeof USER_COUPON_STATUS)[keyof typeof USER_COUPON_STATUS];
export type PointTxKind = (typeof POINT_TX_KIND)[keyof typeof POINT_TX_KIND];

/** Reasons staff pick when rejecting a paid order (OQ-10). `OTHER` needs free text. */
export const ORDER_REJECT_REASON = {
  SOLD_OUT: 'SOLD_OUT',
  CLOSING: 'CLOSING',
  TOO_BUSY: 'TOO_BUSY',
  OTHER: 'OTHER',
} as const;
export type OrderRejectReason = (typeof ORDER_REJECT_REASON)[keyof typeof ORDER_REJECT_REASON];

/** Staff actions accepted by `staff_transition_order`. */
export const STAFF_ORDER_ACTION = {
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  START_PREPARING: 'START_PREPARING',
  MARK_READY: 'MARK_READY',
  COMPLETE: 'COMPLETE',
} as const;
export type StaffOrderAction = (typeof STAFF_ORDER_ACTION)[keyof typeof STAFF_ORDER_ACTION];

/** What the payment function tells the client to do next. */
export const NEXT_ACTION = {
  TEST_SHEET: 'TEST_SHEET',
  REDIRECT: 'REDIRECT',
  NONE: 'NONE',
} as const;

/** Scenarios of the TEST payment sheet (`payments-test-pg`). Non-APPROVE/FAIL/CANCEL ones are dev-only. */
export const TEST_PG_SCENARIO = {
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  CANCEL: 'CANCEL',
  SUCCESS_WEBHOOK_ONLY: 'SUCCESS_WEBHOOK_ONLY',
  SUCCESS_DUPLICATE_WEBHOOK: 'SUCCESS_DUPLICATE_WEBHOOK',
  SUCCESS_LATE: 'SUCCESS_LATE',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
} as const;
export type TestPgScenario = (typeof TEST_PG_SCENARIO)[keyof typeof TEST_PG_SCENARIO];

/** Source and target status of each staff action; `staff_transition_order` in SQL enforces the same table. */
export const STAFF_ORDER_EDGES: Record<StaffOrderAction, { from: OrderStatus; to: OrderStatus }> = {
  ACCEPT: { from: 'PAID', to: 'ACCEPTED' },
  REJECT: { from: 'PAID', to: 'REJECTED' },
  START_PREPARING: { from: 'ACCEPTED', to: 'PREPARING' },
  MARK_READY: { from: 'PREPARING', to: 'READY' },
  COMPLETE: { from: 'READY', to: 'COMPLETED' },
};
