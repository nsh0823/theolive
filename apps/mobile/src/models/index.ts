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
  /** Only temperatures the store sells for this item (PRD 5.3 ORD-04). */
  temperatures: Temperature[];
  isSoldOut: boolean;
};

export type CartLine = {
  menuItemId: string;
  temperature: Temperature;
  quantity: number;
};

export type OrderLine = {
  menuItemId: string;
  name: string;
  temperature: Temperature;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  orderType: OrderType;
  lines: OrderLine[];
  menuAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  paidAmount: number;
};

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

/** Sample inquiry entry shown in the inquiry list (channel is still an open decision). */
export type Inquiry = { id: string; title: string; at: string; isAnswered: boolean };
export type StampExchangeOption = { id: string; requiredStamps: number; title: string };
export type PointSummary = { balance: number };

export const COUPON_STATUS = { AVAILABLE: 'AVAILABLE', USED: 'USED', EXPIRED: 'EXPIRED' } as const;
export type CouponStatus = (typeof COUPON_STATUS)[keyof typeof COUPON_STATUS];

export type Coupon = {
  id: string;
  title: string;
  /** Display-only amount; the server decides the real discount (PRD 15 open question 4). */
  discountAmount: number;
  expiresAt: string;
  status: CouponStatus;
};

/** Ledger rows: stamps and points are separate assets (PRD 5.5). */
export type LedgerKind = 'EARN' | 'USE' | 'CANCEL';
export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  label: string;
  amount: number;
  at: string;
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
};

export type Notice = { id: string; title: string; body: string; publishedAt: string };

export type NotificationPreferences = { orderUpdates: boolean; notices: boolean };

export type PointCodeResult =
  { status: 'registered' } | { status: 'invalid' | 'duplicate' | 'expired' };
