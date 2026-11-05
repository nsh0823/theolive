import {
  COUPON_STATUS,
  NOTICE_STATUS,
  POINT_CODE_STATUS,
  STAFF_PERMISSION,
  STAMP_EARN_MODE,
  STAMP_EARN_TIMING,
  WEEKDAY,
  type BusinessHours,
  type IssuedCoupon,
  type NotificationSettings,
  type Notice,
  type PointCode,
  type StaffMember,
  type StampExchangeRule,
  type StampOverview,
  type StampPolicy,
  type StoreInfo,
  type StoreStatus,
} from '@/domain/models';

export const createStoreStatus = (): StoreStatus => ({ isOpen: true, isAcceptingOrders: true });

export const createStoreInfo = (): StoreInfo => ({
  name: '더 올리브 카페',
  phone: '02-123-4567',
  address: '서울특별시 마포구 월드컵로 12길 7, 1층',
  description: '교회 옆 작은 카페, 올리브나무 아래에서 따뜻한 한 잔을 만나보세요.',
});

export const createHours = (): BusinessHours[] =>
  Object.values(WEEKDAY).map((weekday) => ({
    weekday,
    isClosed: weekday === WEEKDAY.SUN,
    opensAt: weekday === WEEKDAY.SAT ? '10:00' : '08:00',
    closesAt: weekday === WEEKDAY.SAT ? '20:00' : '21:00',
  }));

export const createNotificationSettings = (): NotificationSettings => ({
  newOrderSound: true,
  newOrderBanner: true,
  soldOutReminder: false,
  dailySummary: true,
});

export const createStaff = (): StaffMember[] => [
  {
    id: 'st1',
    name: '김올리',
    email: 'owner@theolive.example',
    isActive: true,
    permissions: [STAFF_PERMISSION.PROCESS_ORDERS, STAFF_PERMISSION.MANAGE_OPERATIONS],
  },
  {
    id: 'st2',
    name: '이서연',
    email: 'seoyeon@theolive.example',
    isActive: true,
    permissions: [STAFF_PERMISSION.PROCESS_ORDERS, STAFF_PERMISSION.MANAGE_OPERATIONS],
  },
  {
    id: 'st3',
    name: '박민준',
    email: 'minjun@theolive.example',
    isActive: true,
    permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
  },
  {
    id: 'st4',
    name: '최지우',
    email: 'jiwoo@theolive.example',
    isActive: false,
    permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
  },
];

export const createNotices = (): Notice[] => [
  {
    id: 'n1',
    title: '추석 연휴 영업 시간 안내',
    body: '연휴 기간에는 오전 10시부터 오후 6시까지 운영합니다.',
    status: NOTICE_STATUS.PUBLISHED,
    createdAt: '2026-10-28T09:00:00',
    publishedAt: '2026-10-28T09:10:00',
  },
  {
    id: 'n2',
    title: '신메뉴 출시: 유자차',
    body: '달콤새콤한 유자차가 새로 나왔어요. HOT / ICE 모두 가능합니다.',
    status: NOTICE_STATUS.PUBLISHED,
    createdAt: '2026-11-01T10:30:00',
    publishedAt: '2026-11-01T11:00:00',
  },
  {
    id: 'n3',
    title: '11월 올리브 스탬프 이벤트 (준비 중)',
    body: '이벤트 내용은 확정 후 게시합니다.',
    status: NOTICE_STATUS.UNPUBLISHED,
    createdAt: '2026-11-03T15:20:00',
    publishedAt: null,
  },
];

export const createStampPolicy = (): StampPolicy => ({
  earnMode: STAMP_EARN_MODE.PER_ORDER,
  amountPerStamp: 5000,
  earnTiming: STAMP_EARN_TIMING.COMPLETED,
});

export const createExchangeRules = (): StampExchangeRule[] => [
  {
    id: 'r10',
    requiredStamps: 10,
    couponTitle: '아메리카노 또는 라떼 쿠폰',
    validDays: 90,
    isActive: true,
  },
  { id: 'r15', requiredStamps: 15, couponTitle: '전체 음료 쿠폰', validDays: 90, isActive: true },
];

export const createStampOverview = (): StampOverview => ({
  earnedThisMonth: 1284,
  exchangedCoupons: 37,
  outstandingStamps: 2951,
});

export const createIssuedCoupons = (): IssuedCoupon[] => [
  {
    id: 'c1',
    title: '아메리카노 또는 라떼 쿠폰',
    issuedAt: '2026-11-02T10:00:00',
    expiresAt: '2027-01-31T23:59:00',
    status: COUPON_STATUS.AVAILABLE,
  },
  {
    id: 'c2',
    title: '전체 음료 쿠폰',
    issuedAt: '2026-10-30T14:12:00',
    expiresAt: '2027-01-28T23:59:00',
    status: COUPON_STATUS.AVAILABLE,
  },
  {
    id: 'c3',
    title: '아메리카노 또는 라떼 쿠폰',
    issuedAt: '2026-10-12T09:40:00',
    expiresAt: '2027-01-10T23:59:00',
    status: COUPON_STATUS.USED,
  },
  {
    id: 'c4',
    title: '아메리카노 또는 라떼 쿠폰',
    issuedAt: '2026-07-01T12:00:00',
    expiresAt: '2026-09-29T23:59:00',
    status: COUPON_STATUS.EXPIRED,
  },
];

export const createPointCodes = (): PointCode[] => [
  {
    id: 'p1',
    code: 'OLIVE-7K2M-9QXD',
    amount: 15000,
    remaining: 12000,
    status: POINT_CODE_STATUS.REGISTERED,
    issuedAt: '2026-10-20T10:00:00',
    expiresAt: '2027-04-20T23:59:00',
    registeredAt: '2026-11-01T09:12:00',
    memo: '청년부 헌신 감사 선물',
  },
  {
    id: 'p2',
    code: 'OLIVE-3H8R-TW4N',
    amount: 10000,
    remaining: 10000,
    status: POINT_CODE_STATUS.UNUSED,
    issuedAt: '2026-10-20T10:00:00',
    expiresAt: '2027-04-20T23:59:00',
    registeredAt: null,
    memo: '청년부 헌신 감사 선물',
  },
  {
    id: 'p3',
    code: 'OLIVE-5B6C-LP2V',
    amount: 5000,
    remaining: 0,
    status: POINT_CODE_STATUS.EXHAUSTED,
    issuedAt: '2026-09-15T11:00:00',
    expiresAt: '2027-03-15T23:59:00',
    registeredAt: '2026-09-17T13:30:00',
    memo: '새가족 환영 선물',
  },
  {
    id: 'p4',
    code: 'OLIVE-9D1F-ZK7J',
    amount: 5000,
    remaining: 5000,
    status: POINT_CODE_STATUS.EXPIRED,
    issuedAt: '2026-03-01T11:00:00',
    expiresAt: '2026-09-01T23:59:00',
    registeredAt: null,
    memo: '봄 행사 참가 선물',
  },
];

/** Daily sales for the six days before today (display fixture). Today's bar is computed from orders. */
export const PRIOR_DAILY_SALES: readonly number[] = [
  286400, 312800, 268500, 341200, 398700, 214600,
];
