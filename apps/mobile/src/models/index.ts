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

export type Profile = { displayName: string };

export type StampSummary = { count: number; goal: number };
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

export type NotificationKind = 'ORDER' | 'NOTICE';
export type AppNotification = { id: string; kind: NotificationKind; title: string; at: string };

export type Notice = { id: string; title: string; body: string; publishedAt: string };

export type NotificationPreferences = { orderUpdates: boolean; notices: boolean };

export type PointCodeResult =
  { status: 'registered' } | { status: 'invalid' | 'duplicate' | 'expired' };
