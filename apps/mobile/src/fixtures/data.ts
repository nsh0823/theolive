/**
 * PLACEHOLDER DATA ONLY. Every export here stands in for a server response and must be
 * replaced by a TanStack Query hook (packages/api or src/hooks) once the schema exists.
 * Amounts are display values; the server recalculates every price (PRD 5.3, 11.3).
 */
import {
  COUPON_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  TEMPERATURE,
  type AppNotification,
  type Coupon,
  type LedgerEntry,
  type MenuCategory,
  type MenuItem,
  type Notice,
  type NotificationPreferences,
  type Order,
  type PointSummary,
  type Profile,
  type StampExchangeOption,
  type StampSummary,
} from '@/models';

export const FIXTURE_PROFILE: Profile = { displayName: '피터' };

export const FIXTURE_CATEGORIES: MenuCategory[] = [
  { id: 'coffee', name: '커피' },
  { id: 'latte', name: '라떼' },
  { id: 'tea', name: '티' },
  { id: 'dessert', name: '디저트' },
];

const BOTH = [TEMPERATURE.HOT, TEMPERATURE.ICE];

export const FIXTURE_MENU: MenuItem[] = [
  {
    id: 'americano',
    categoryId: 'coffee',
    name: '아메리카노',
    description: '진한 에스프레소에 물을 더한 깊은 풍미의 커피',
    price: 4500,
    temperatures: BOTH,
    isSoldOut: false,
  },
  {
    id: 'cold-brew',
    categoryId: 'coffee',
    name: '콜드브루',
    description: '저온에서 오래 우려낸 부드러운 커피',
    price: 5000,
    temperatures: [TEMPERATURE.ICE],
    isSoldOut: false,
  },
  {
    id: 'latte',
    name: '카페 라떼',
    categoryId: 'latte',
    description: '에스프레소와 스팀 우유의 부드러운 조화',
    price: 5000,
    temperatures: BOTH,
    isSoldOut: false,
  },
  {
    id: 'vanilla-latte',
    categoryId: 'latte',
    name: '바닐라 라떼',
    description: '바닐라 시럽을 더한 달콤한 라떼',
    price: 5500,
    temperatures: BOTH,
    isSoldOut: true,
  },
  {
    id: 'green-tea',
    categoryId: 'tea',
    name: '그린티',
    description: '은은한 향의 따뜻한 녹차',
    price: 4800,
    temperatures: [TEMPERATURE.HOT],
    isSoldOut: false,
  },
  {
    id: 'scone',
    categoryId: 'dessert',
    name: '플레인 스콘',
    description: '겉은 바삭하고 속은 촉촉한 스콘',
    price: 3800,
    temperatures: BOTH,
    isSoldOut: false,
  },
];

export const FIXTURE_RECENT_MENU_IDS: string[] = ['americano', 'latte', 'cold-brew'];

export const FIXTURE_STAMPS: StampSummary = { count: 7, goal: 10 };
export const FIXTURE_POINTS: PointSummary = { balance: 12000 };

export const FIXTURE_STAMP_EXCHANGE: StampExchangeOption[] = [
  { id: 'stamp-10', requiredStamps: 10, title: '아메리카노 또는 라떼 쿠폰' },
  { id: 'stamp-15', requiredStamps: 15, title: '전체 음료 쿠폰' },
];

export const FIXTURE_COUPONS: Coupon[] = [
  {
    id: 'c1',
    title: '아메리카노 또는 라떼 쿠폰',
    discountAmount: 5000,
    expiresAt: '2026.12.31',
    status: COUPON_STATUS.AVAILABLE,
  },
  {
    id: 'c2',
    title: '전체 음료 쿠폰',
    discountAmount: 5500,
    expiresAt: '2026.11.30',
    status: COUPON_STATUS.USED,
  },
  {
    id: 'c3',
    title: '아메리카노 또는 라떼 쿠폰',
    discountAmount: 5000,
    expiresAt: '2026.09.30',
    status: COUPON_STATUS.EXPIRED,
  },
];

export const FIXTURE_STAMP_LEDGER: LedgerEntry[] = [
  { id: 's1', kind: 'EARN', label: '주문 적립', amount: 1, at: '2026.11.03' },
  { id: 's2', kind: 'EARN', label: '주문 적립', amount: 1, at: '2026.10.28' },
  { id: 's3', kind: 'USE', label: '쿠폰 교환', amount: -10, at: '2026.10.15' },
];

export const FIXTURE_POINT_LEDGER: LedgerEntry[] = [
  { id: 'p1', kind: 'EARN', label: '포인트 코드 등록', amount: 15000, at: '2026.11.01' },
  { id: 'p2', kind: 'USE', label: '주문 결제 사용', amount: -3000, at: '2026.11.03' },
  { id: 'p3', kind: 'CANCEL', label: '주문 취소 복구', amount: 1000, at: '2026.11.04' },
];

export const FIXTURE_ORDERS: Order[] = [
  {
    id: 'o1',
    orderNumber: 'A-34',
    placedAt: '2026.11.04 13:50',
    status: ORDER_STATUS.PREPARING,
    orderType: ORDER_TYPE.TAKEOUT,
    lines: [{ name: '아메리카노', temperature: TEMPERATURE.ICE, quantity: 2, unitPrice: 4500 }],
    menuAmount: 9000,
    couponDiscount: 0,
    pointsUsed: 3000,
    paidAmount: 6000,
  },
  {
    id: 'o2',
    orderNumber: 'A-25',
    placedAt: '2026.10.31 14:46',
    status: ORDER_STATUS.COMPLETED,
    orderType: ORDER_TYPE.DINE_IN,
    lines: [
      { name: '카페 라떼', temperature: TEMPERATURE.HOT, quantity: 1, unitPrice: 5000 },
      { name: '플레인 스콘', temperature: TEMPERATURE.HOT, quantity: 1, unitPrice: 3800 },
    ],
    menuAmount: 8800,
    couponDiscount: 0,
    pointsUsed: 0,
    paidAmount: 8800,
  },
  {
    id: 'o3',
    orderNumber: 'A-12',
    placedAt: '2026.10.20 09:12',
    status: ORDER_STATUS.REJECTED,
    orderType: ORDER_TYPE.TAKEOUT,
    lines: [{ name: '콜드브루', temperature: TEMPERATURE.ICE, quantity: 1, unitPrice: 5000 }],
    menuAmount: 5000,
    couponDiscount: 0,
    pointsUsed: 0,
    paidAmount: 5000,
  },
];

export const FIXTURE_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'ORDER',
    title: '메뉴가 준비되었어요. (A-34) 픽업대에서 메뉴를 픽업해 주세요.',
    at: '2026.11.04 13:53',
  },
  { id: 'n2', kind: 'ORDER', title: '주문이 접수되었어요. (A-34)', at: '2026.11.04 13:51' },
  { id: 'n3', kind: 'NOTICE', title: '11월 영업시간 안내', at: '2026.11.01 10:00' },
];

export const FIXTURE_NOTICES: Notice[] = [
  {
    id: 'nt1',
    title: '11월 영업시간 안내',
    body: '영업시간 변경 내용은 추후 매장 설정에서 불러옵니다. (placeholder)',
    publishedAt: '2026.11.01',
  },
  {
    id: 'nt2',
    title: '스탬프 적립 안내',
    body: '스탬프 적립 기준은 점주 확정 후 안내됩니다. (placeholder)',
    publishedAt: '2026.10.20',
  },
];

export const FIXTURE_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  notices: true,
};

export const FIXTURE_TERMS = [
  { id: 'terms', title: '이용약관', body: '최신 이용약관 본문이 이곳에 표시됩니다. (placeholder)' },
  {
    id: 'privacy',
    title: '개인정보 처리방침',
    body: '최신 개인정보 처리방침 본문이 이곳에 표시됩니다. (placeholder)',
  },
];

export const FIXTURE_INQUIRY_CHANNEL = {
  label: '문의 접수 채널',
  description: '문의 접수 채널은 운영 확정 후 연결됩니다. (placeholder)',
};
