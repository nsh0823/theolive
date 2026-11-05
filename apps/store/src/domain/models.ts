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
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

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
  pointsUsed: number;
  paidAmount: number;
  /** Owner of the order; `null` for guest or unknown. Used by Store Admin 회원관리. */
  memberId: string | null;
  /** Set when staff reject the order (PRD SW-03). */
  rejectReason: string | null;
};

export type MenuCategory = { id: string; name: string; isActive: boolean };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  /** HOT / ICE only (brief: no size, syrup, milk, or extra shot). */
  temperatures: Temperature[];
  isSoldOut: boolean;
  /** `false` hides the item from customers entirely (판매 중지). */
  isActive: boolean;
};

export type StoreStatus = {
  isOpen: boolean;
  isAcceptingOrders: boolean;
};

export const WEEKDAY = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 } as const;
export type BusinessHours = {
  weekday: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

export type StoreInfo = { name: string; phone: string; address: string; description: string };

export type NotificationSettings = {
  newOrderSound: boolean;
  newOrderBanner: boolean;
  soldOutReminder: boolean;
  dailySummary: boolean;
};

export const STAFF_PERMISSION = {
  PROCESS_ORDERS: 'PROCESS_ORDERS',
  MANAGE_OPERATIONS: 'MANAGE_OPERATIONS',
} as const;
export type StaffPermission = (typeof STAFF_PERMISSION)[keyof typeof STAFF_PERMISSION];

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  permissions: StaffPermission[];
};

export const NOTICE_STATUS = { PUBLISHED: 'PUBLISHED', UNPUBLISHED: 'UNPUBLISHED' } as const;
export type NoticeStatus = (typeof NOTICE_STATUS)[keyof typeof NOTICE_STATUS];

export type Notice = {
  id: string;
  title: string;
  body: string;
  status: NoticeStatus;
  createdAt: string;
  publishedAt: string | null;
};

/** Olive Stamps (PRD 5.5 A). Never share types or storage with Coupon Points. */
export const STAMP_EARN_MODE = { PER_ORDER: 'PER_ORDER', PER_AMOUNT: 'PER_AMOUNT' } as const;
export type StampEarnMode = (typeof STAMP_EARN_MODE)[keyof typeof STAMP_EARN_MODE];

export const STAMP_EARN_TIMING = {
  PAID: 'PAID',
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
} as const;
export type StampEarnTiming = (typeof STAMP_EARN_TIMING)[keyof typeof STAMP_EARN_TIMING];

export type StampPolicy = {
  earnMode: StampEarnMode;
  /** Won spent per stamp; used only for PER_AMOUNT. */
  amountPerStamp: number;
  earnTiming: StampEarnTiming;
};

export type StampExchangeRule = {
  id: string;
  requiredStamps: number;
  couponTitle: string;
  validDays: number;
  isActive: boolean;
};

export const COUPON_STATUS = { AVAILABLE: 'AVAILABLE', USED: 'USED', EXPIRED: 'EXPIRED' } as const;
export type CouponStatus = (typeof COUPON_STATUS)[keyof typeof COUPON_STATUS];

export type IssuedCoupon = {
  id: string;
  title: string;
  issuedAt: string;
  expiresAt: string;
  status: CouponStatus;
};

export type StampOverview = {
  earnedThisMonth: number;
  exchangedCoupons: number;
  outstandingStamps: number;
};

/** Coupon Points (PRD 5.5 B): code-issued credit, spent like cash. Separate from stamps. */
export const POINT_CODE_STATUS = {
  UNUSED: 'UNUSED',
  REGISTERED: 'REGISTERED',
  EXHAUSTED: 'EXHAUSTED',
  EXPIRED: 'EXPIRED',
} as const;
export type PointCodeStatus = (typeof POINT_CODE_STATUS)[keyof typeof POINT_CODE_STATUS];

export type PointCode = {
  id: string;
  code: string;
  amount: number;
  remaining: number;
  status: PointCodeStatus;
  issuedAt: string;
  expiresAt: string;
  registeredAt: string | null;
  memo: string;
};
