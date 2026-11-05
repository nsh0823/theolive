import { makeOrder } from '../test-utils/testOrders';
import { TEST_MENU } from '../test-utils/testMenu';
import { filterNotifications, notificationOrderId, unreadCount } from '@/lib/notifications';
import type { AppNotification } from '@/models';
import { searchMenu } from '@/lib/menuSearch';
import {
  INITIAL_PIN_FLOW,
  PIN_MISMATCH_MESSAGE,
  isPinConfirmed,
  pinFlowReducer,
  type PinFlowState,
} from '@/lib/pin';
import { combineStates } from '@/lib/queryState';
import { planReorder, recentOrderLines } from '@/lib/reorder';
import { stampProgress } from '@/lib/stamps';
import { useCartStore } from '@/store/useCartStore';

function at<T>(list: T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`fixture index ${index} missing`);
  return value;
}

function type(digits: string, from: PinFlowState = INITIAL_PIN_FLOW) {
  return [...digits].reduce(
    (state, value) => pinFlowReducer(state, { type: 'digit', value }),
    from,
  );
}

describe('stampProgress', () => {
  it('reports remaining stamps and fraction', () => {
    expect(stampProgress({ count: 7, goal: 10 })).toEqual({
      remaining: 3,
      fraction: 0.7,
      isComplete: false,
    });
  });
  it('clamps overflow and handles a zero goal', () => {
    expect(stampProgress({ count: 12, goal: 10 }).isComplete).toBe(true);
    expect(stampProgress({ count: 12, goal: 10 }).remaining).toBe(0);
    expect(stampProgress({ count: 3, goal: 0 })).toEqual({
      remaining: 0,
      fraction: 0,
      isComplete: false,
    });
  });
});

describe('searchMenu', () => {
  it('matches name or description and ignores blank queries', () => {
    expect(searchMenu(TEST_MENU, '라떼').map((i) => i.id)).toContain('latte');
    expect(searchMenu(TEST_MENU, '스콘')).toHaveLength(1);
    expect(searchMenu(TEST_MENU, '   ')).toEqual([]);
    expect(searchMenu(TEST_MENU, '없는메뉴')).toEqual([]);
  });
});

describe('pin flow', () => {
  it('requires the same four digits twice', () => {
    const afterFirst = type('1234');
    expect(afterFirst.step).toBe('confirm');
    expect(isPinConfirmed(type('1234', afterFirst))).toBe(true);
  });
  it('resets with a message on mismatch', () => {
    const mismatch = type('1235', type('1234'));
    expect(mismatch.step).toBe('enter');
    expect(mismatch.error).toBe(PIN_MISMATCH_MESSAGE);
  });
  it('ignores non-digits, overflow, and supports delete', () => {
    expect(type('ab').entry).toBe('');
    expect(pinFlowReducer(type('12'), { type: 'delete' }).entry).toBe('1');
    expect(pinFlowReducer(type('12'), { type: 'delete' }).error).toBeNull();
  });
});

const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'ORDER',
    title: '주문이 접수되었어요. (A-34)',
    at: '2026.11.04 13:51',
    isRead: false,
    orderId: 'o1',
  },
  {
    id: 'n2',
    kind: 'PAYMENT',
    title: '6,000원 결제가 완료되었어요. (A-34)',
    at: '2026.11.04 13:50',
    isRead: true,
    orderId: 'o1',
  },
  {
    id: 'n3',
    kind: 'STAMP',
    title: '올리브 스탬프 1개가 적립되었어요.',
    at: '2026.11.03 14:50',
    isRead: false,
    orderId: null,
  },
];

describe('notifications', () => {
  it('counts unread by the server flag', () => {
    expect(unreadCount(NOTIFICATIONS)).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
  it('filters by kind', () => {
    expect(filterNotifications(NOTIFICATIONS, 'STAMP')).toHaveLength(1);
    expect(filterNotifications(NOTIFICATIONS, 'all')).toHaveLength(NOTIFICATIONS.length);
  });
  it('opens an order only for order and payment messages', () => {
    expect(notificationOrderId(at(NOTIFICATIONS, 0))).toBe('o1');
    expect(notificationOrderId(at(NOTIFICATIONS, 1))).toBe('o1');
    expect(notificationOrderId({ ...at(NOTIFICATIONS, 2), orderId: 'x' })).toBeNull();
  });
});

describe('reorder', () => {
  const ORDERS = [
    makeOrder({ id: 'new' }),
    makeOrder({
      id: 'rejected',
      status: 'REJECTED',
      lines: [
        {
          menuItemId: 'cold-brew',
          name: '콜드브루',
          temperature: 'ICE',
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    }),
  ];
  it('lists recent lines newest first and skips rejected orders', () => {
    const lines = recentOrderLines(ORDERS, 10);
    expect(at(lines, 0).name).toBe('아메리카노');
    expect(lines.map((l) => l.name)).not.toContain('콜드브루');
    expect(recentOrderLines(ORDERS, 1)).toHaveLength(1);
  });
  it('skips sold-out, missing, and unavailable-temperature lines', () => {
    const plan = planReorder(
      [
        { menuItemId: 'americano', name: '아메리카노', temperature: 'ICE', quantity: 2 },
        { menuItemId: 'vanilla-latte', name: '바닐라 라떼', temperature: 'HOT', quantity: 1 },
        { menuItemId: 'cold-brew', name: '콜드브루', temperature: 'HOT', quantity: 1 },
        { menuItemId: 'gone', name: '사라진 메뉴', temperature: 'HOT', quantity: 1 },
      ],
      TEST_MENU,
    );
    expect(plan.add).toEqual([{ menuItemId: 'americano', temperature: 'ICE', quantity: 2 }]);
    expect(plan.skippedNames).toEqual(['바닐라 라떼', '콜드브루', '사라진 메뉴']);
  });
});

describe('queryState', () => {
  it('offline wins over error and success', () => {
    const refetch = jest.fn();
    const combined = combineStates(
      { status: 'offline', refetch },
      { status: 'error', message: 'x', refetch },
    );
    expect(combined.status).toBe('offline');
  });
});

describe('cart store additions', () => {
  beforeEach(() => useCartStore.setState({ lines: [] }));

  it('changes temperature in place', () => {
    useCartStore.getState().addLine('americano', 'HOT', 1);
    useCartStore.getState().changeTemperature('americano', 'HOT', 'ICE');
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'americano', temperature: 'ICE', quantity: 1 },
    ]);
  });
  it('merges into an existing line when the target temperature is already in the cart', () => {
    useCartStore.getState().addLine('americano', 'HOT', 1);
    useCartStore.getState().addLine('americano', 'ICE', 2);
    useCartStore.getState().changeTemperature('americano', 'HOT', 'ICE');
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'americano', temperature: 'ICE', quantity: 3 },
    ]);
  });
  it('adds several lines at once', () => {
    useCartStore.getState().addLines([
      { menuItemId: 'latte', temperature: 'HOT', quantity: 1 },
      { menuItemId: 'scone', temperature: 'HOT', quantity: 2 },
    ]);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });
});
