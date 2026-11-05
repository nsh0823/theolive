// UI view-models. Replace with generated Supabase row types once the schema exists.

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

export type MenuCategory = { id: string; name: string };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  /** Only temperatures the store sells for this item (PRD 5.3 ORD-04). Empty: no temperature choice (OQ-16). */
  temperatures: Temperature[];
  isSoldOut: boolean;
  /** Public photo URL, or null for the placeholder tile. */
  imageUrl: string | null;
};

/** The cart keeps only what the customer chose; names and prices always come from the server menu. */
export type CartLine = {
  menuItemId: string;
  /** `null` for items that have no temperature choice. */
  temperature: Temperature | null;
  quantity: number;
};

/** Server order snapshot (names and prices as they were when paid). Shared with the store apps via packages/api. */
export type { OrderLineView as OrderLine, OrderView as Order } from '@theolive/api';

export type Profile = { displayName: string; email: string; loginProvider: string };

/** UI-only payment choices. Which methods are really offered depends on the PG contract. */
export const PAYMENT_METHOD = {
  KAKAO_PAY: 'KAKAO_PAY',
  NAVER_PAY: 'NAVER_PAY',
  TOSS_PAY: 'TOSS_PAY',
  CARD: 'CARD',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const BIOMETRIC_STATUS = {
  AVAILABLE: 'AVAILABLE',
  NOT_ENROLLED: 'NOT_ENROLLED',
  UNSUPPORTED: 'UNSUPPORTED',
} as const;
export type BiometricStatus = (typeof BIOMETRIC_STATUS)[keyof typeof BIOMETRIC_STATUS];

export type StampSummary = { count: number; goal: number };

// Olive Stamps and reward coupons come from the server through packages/api; these are its view types.
export type {
  CouponBenefit,
  CouponView as Coupon,
  CouponWalletStatus as CouponStatus,
  StampExchangeOptionView as StampExchangeOption,
} from '@theolive/api';
export { USER_COUPON_STATUS as COUPON_STATUS } from '@theolive/types';
// Coupon Points come from the server too; separate from the stamp and coupon types above.
export type { PointSummaryView as PointSummary } from '@theolive/api';

/** Ledger rows: stamps and points are separate assets (PRD 5.5). */
export type LedgerKind = 'EARN' | 'USE' | 'CANCEL' | 'EXPIRE';
export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  label: string;
  amount: number;
  at: string;
  /** Extra line under the date, e.g. when the points end. */
  note?: string;
};

export const NOTIFICATION_KIND = {
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  STAMP: 'STAMP',
  COUPON: 'COUPON',
  POINT: 'POINT',
  NOTICE: 'NOTICE',
} as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
  isRead: boolean;
  /** Set for order and payment messages, so a tap can open that order. */
  orderId: string | null;
};

export type Notice = { id: string; title: string; body: string; publishedAt: string };

export type NotificationPreferences = { orderUpdates: boolean; notices: boolean };
