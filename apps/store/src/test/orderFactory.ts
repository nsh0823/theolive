import {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  TEMPERATURE,
  type Order,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type Temperature,
} from '@/domain/models';
import { MS_PER_MINUTE } from '@/lib/time';
import { ORDER_FIXTURE_MENU } from './orderFactoryMenu';

type LineSpec = [menuItemId: string, temperature: Temperature, quantity: number];

type OrderSpec = {
  number: string;
  minutesAgo: number;
  status: OrderStatus;
  type: OrderType;
  lines: LineSpec[];
  note?: string;
  payment?: PaymentStatus;
  method?: PaymentMethod;
  coupon?: number;
  points?: number;
  rejectReason?: string;
};

const { HOT, ICE } = TEMPERATURE;
const { PAID, ACCEPTED, PREPARING, READY, COMPLETED, REJECTED } = ORDER_STATUS;
const { DINE_IN, TAKEOUT } = ORDER_TYPE;

const SPECS: OrderSpec[] = [
  // Today: active board.
  {
    number: 'A-41',
    minutesAgo: 1,
    status: PAID,
    type: TAKEOUT,
    lines: [
      ['americano', ICE, 2],
      ['scone', HOT, 1],
    ],
    note: '얼음 적게 부탁드려요',
  },
  {
    number: 'A-40',
    minutesAgo: 3,
    status: PAID,
    type: DINE_IN,
    lines: [['latte', HOT, 1]],
    method: PAYMENT_METHOD.KAKAO_PAY,
  },
  {
    number: 'A-39',
    minutesAgo: 6,
    status: PAID,
    type: TAKEOUT,
    lines: [
      ['cold-brew', ICE, 1],
      ['choco-milk', ICE, 1],
    ],
    method: PAYMENT_METHOD.NAVER_PAY,
    points: 3000,
  },
  {
    number: 'A-38',
    minutesAgo: 9,
    status: ACCEPTED,
    type: DINE_IN,
    lines: [['cappuccino', HOT, 2]],
    note: '자리에서 기다리고 있어요',
    method: PAYMENT_METHOD.TOSS_PAY,
  },
  {
    number: 'A-37',
    minutesAgo: 12,
    status: ACCEPTED,
    type: TAKEOUT,
    lines: [
      ['green-tea', HOT, 1],
      ['scone', HOT, 2],
    ],
  },
  {
    number: 'A-36',
    minutesAgo: 15,
    status: PREPARING,
    type: DINE_IN,
    lines: [
      ['americano', HOT, 1],
      ['latte', ICE, 1],
    ],
    coupon: 4500,
  },
  {
    number: 'A-35',
    minutesAgo: 18,
    status: PREPARING,
    type: TAKEOUT,
    lines: [['americano', ICE, 3]],
    note: '컵홀더 3개 주세요',
    method: PAYMENT_METHOD.KAKAO_PAY,
  },
  {
    number: 'A-34',
    minutesAgo: 22,
    status: READY,
    type: TAKEOUT,
    lines: [['americano', ICE, 2]],
    points: 3000,
  },
  {
    number: 'A-33',
    minutesAgo: 27,
    status: READY,
    type: DINE_IN,
    lines: [
      ['yuja-tea', HOT, 1],
      ['choco-milk', HOT, 1],
    ],
  },
  // Today: finished.
  {
    number: 'A-32',
    minutesAgo: 40,
    status: COMPLETED,
    type: DINE_IN,
    lines: [['latte', HOT, 2]],
    method: PAYMENT_METHOD.NAVER_PAY,
  },
  {
    number: 'A-31',
    minutesAgo: 55,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [['americano', ICE, 1]],
  },
  {
    number: 'A-30',
    minutesAgo: 75,
    status: REJECTED,
    type: TAKEOUT,
    lines: [['vanilla-latte', ICE, 1]],
    payment: PAYMENT_STATUS.REFUNDED,
    rejectReason: '재고 부족 (품절)',
  },
  {
    number: 'A-29',
    minutesAgo: 95,
    status: COMPLETED,
    type: DINE_IN,
    lines: [
      ['cold-brew', ICE, 1],
      ['scone', HOT, 1],
    ],
    method: PAYMENT_METHOD.TOSS_PAY,
  },
  {
    number: 'A-28',
    minutesAgo: 130,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [
      ['americano', HOT, 2],
      ['cappuccino', HOT, 1],
    ],
  },
  // Earlier days.
  {
    number: 'A-27',
    minutesAgo: 1500,
    status: COMPLETED,
    type: DINE_IN,
    lines: [
      ['latte', HOT, 1],
      ['scone', HOT, 1],
    ],
  },
  {
    number: 'A-26',
    minutesAgo: 1560,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [['americano', ICE, 4]],
    coupon: 4500,
  },
  {
    number: 'A-25',
    minutesAgo: 1700,
    status: COMPLETED,
    type: DINE_IN,
    lines: [['green-tea', HOT, 2]],
    method: PAYMENT_METHOD.KAKAO_PAY,
  },
  {
    number: 'A-24',
    minutesAgo: 1900,
    status: REJECTED,
    type: DINE_IN,
    lines: [['choco-milk', ICE, 1]],
    payment: PAYMENT_STATUS.REFUNDED,
    rejectReason: '매장 사정 (혼잡)',
  },
  {
    number: 'A-23',
    minutesAgo: 2900,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [['cold-brew', ICE, 2]],
    points: 5000,
  },
  {
    number: 'A-22',
    minutesAgo: 3050,
    status: COMPLETED,
    type: DINE_IN,
    lines: [
      ['yuja-tea', ICE, 1],
      ['scone', HOT, 1],
    ],
  },
  {
    number: 'A-21',
    minutesAgo: 4400,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [
      ['americano', ICE, 2],
      ['latte', ICE, 1],
    ],
    method: PAYMENT_METHOD.NAVER_PAY,
  },
  {
    number: 'A-20',
    minutesAgo: 4500,
    status: COMPLETED,
    type: DINE_IN,
    lines: [['cappuccino', HOT, 1]],
    payment: PAYMENT_STATUS.PARTIAL_REFUNDED,
  },
  {
    number: 'A-19',
    minutesAgo: 5900,
    status: COMPLETED,
    type: TAKEOUT,
    lines: [['americano', HOT, 1]],
  },
];

/** Which member placed each fixture order (keeps 회원관리 consistent with order history). */
const ORDER_MEMBER: Record<string, string> = {
  'A-41': 'm01',
  'A-40': 'm02',
  'A-39': 'm03',
  'A-38': 'm04',
  'A-37': 'm05',
  'A-36': 'm06',
  'A-35': 'm07',
  'A-34': 'm03',
  'A-33': 'm08',
  'A-32': 'm09',
  'A-31': 'm01',
  'A-30': 'm10',
  'A-29': 'm11',
  'A-28': 'm12',
  'A-27': 'm02',
  'A-26': 'm13',
  'A-25': 'm14',
  'A-24': 'm15',
  'A-23': 'm03',
  'A-22': 'm16',
  'A-21': 'm01',
  'A-20': 'm17',
  'A-19': 'm18',
};

export function createOrders(nowMs: number = Date.now()): Order[] {
  return SPECS.map((spec): Order => {
    const lines = spec.lines.map(([menuItemId, temperature, quantity]) => {
      const item = ORDER_FIXTURE_MENU.find((candidate) => candidate.id === menuItemId);
      return {
        menuItemId,
        name: item?.name ?? menuItemId,
        temperature,
        quantity,
        unitPrice: item?.price ?? 0,
      };
    });
    const menuAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const couponDiscount = spec.coupon ?? 0;
    const pointsUsed = spec.points ?? 0;
    return {
      id: `order-${spec.number}`,
      orderNumber: spec.number,
      placedAt: new Date(nowMs - spec.minutesAgo * MS_PER_MINUTE).toISOString(),
      status: spec.status,
      paymentStatus: spec.payment ?? PAYMENT_STATUS.PAID,
      paymentMethod: spec.method ?? PAYMENT_METHOD.CARD,
      orderType: spec.type,
      lines,
      note: spec.note ?? null,
      menuAmount,
      couponDiscount,
      couponTitle: couponDiscount > 0 ? '아메리카노 또는 라떼 쿠폰' : null,
      pointsUsed,
      paidAmount: Math.max(0, menuAmount - couponDiscount - pointsUsed),
      rejectReason: spec.rejectReason ?? null,
      cancelReason: null,
      endedAt: null,
      memberId: ORDER_MEMBER[spec.number] ?? null,
    };
  });
}
