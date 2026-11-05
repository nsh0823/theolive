// View-models for the store apps. Names mirror apps/mobile/src/models so both products share vocabulary.
// Replace with generated Supabase types from packages/types once the schema exists.

export const TEMPERATURE = { HOT: 'HOT', ICE: 'ICE' } as const;
export type Temperature = (typeof TEMPERATURE)[keyof typeof TEMPERATURE];

export const ORDER_TYPE = { DINE_IN: 'DINE_IN', TAKEOUT: 'TAKEOUT' } as const;
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

/** PRD 7.1 order states. */
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** PRD 7.2 payment states. Kept separate from order status. */
export const PAYMENT_STATUS = {
  READY: 'READY',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PARTIAL_REFUNDED: 'PARTIAL_REFUNDED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_METHOD = {
  KAKAO_PAY: 'KAKAO_PAY',
  NAVER_PAY: 'NAVER_PAY',
  TOSS_PAY: 'TOSS_PAY',
  CARD: 'CARD',
  /** Zero-amount order: nothing was charged (OQ-18). */
  NONE: 'NONE',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export type OrderLine = {
  menuItemId: string;
  name: string;
  /** `null` for items sold without a temperature choice. */
  temperature: Temperature | null;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  /** ISO 8601 timestamp. */
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  orderType: OrderType;
  lines: OrderLine[];
  /** Customer request. `null` when none. */
  note: string | null;
  menuAmount: number;
  couponDiscount: number;
  /** Title of the Olive Stamp reward coupon applied to this order (snapshot), or `null`. */
  couponTitle: string | null;
  pointsUsed: number;
  paidAmount: number;
  /** Owner of the order; `null` for guest or unknown. Used by Store Admin 회원관리. */
  memberId: string | null;
  /** Set when staff reject the order (PRD SW-03). */
  rejectReason: string | null;
  /** Why an order was cancelled (customer, admin or system), when known. */
  cancelReason: string | null;
  /** When the order was rejected or cancelled; `null` otherwise. Used to tell a stuck refund from a fresh one. */
  endedAt: string | null;
};

export const WEEKDAY = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 } as const;

// Menu and store settings come from the server through packages/api; these are its view types.
export type {
  BusinessHoursView as BusinessHours,
  MenuCategoryView as MenuCategory,
  MenuItemView as MenuItem,
  NotificationSettingsView as NotificationSettings,
  StoreInfoView as StoreInfo,
  StoreStatusView as StoreStatus,
} from '@theolive/api';

export { STAFF_PERMISSION, type StaffPermission } from '@theolive/types';

export const NOTICE_STATUS = { PUBLISHED: 'PUBLISHED', UNPUBLISHED: 'UNPUBLISHED' } as const;
export type NoticeStatus = (typeof NOTICE_STATUS)[keyof typeof NOTICE_STATUS];

// Olive Stamps (PRD 5.5 A). Never share types or storage with Coupon Points.
export { STAMP_EARN_MODE, type StampEarnMode } from '@theolive/types';

export const COUPON_STATUS = { AVAILABLE: 'AVAILABLE', USED: 'USED', EXPIRED: 'EXPIRED' } as const;
export type CouponStatus = (typeof COUPON_STATUS)[keyof typeof COUPON_STATUS];
