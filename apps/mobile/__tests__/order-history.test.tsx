import { fireEvent, render, screen } from '@testing-library/react-native';

import OrderDetailScreen from '../app/(tabs)/other/orders/[orderId]';
import OrdersScreen from '../app/(tabs)/other/orders/index';
import { useOrderQuery, useOrdersQuery } from '@/hooks/useOrders';
import { useCartStore } from '@/store/useCartStore';
import { makeOrder } from '../test-utils/testOrders';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/useRouteParam', () => ({ useRouteParam: () => 'order-1' }));
jest.mock('@/hooks/useOrders', () => ({
  useOrdersQuery: jest.fn(),
  useOrderQuery: jest.fn(),
  useCancelOrderMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const orders = jest.mocked(useOrdersQuery);
const order = jest.mocked(useOrderQuery);

beforeEach(() => {
  jest.clearAllMocks();
  useCartStore.setState({ lines: [], orderType: 'TAKEOUT' });
});

describe('order history', () => {
  it('shows the empty state with a way to start ordering', async () => {
    orders.mockReturnValue({ status: 'success', data: [] });
    await render(<OrdersScreen />);
    expect(screen.getByText('아직 주문 내역이 없어요.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('메뉴 보러 가기'));
    expect(mockPush).toHaveBeenCalledWith('/order');
  });

  it('shows loading, error and disconnected states', async () => {
    orders.mockReturnValue({ status: 'loading' });
    const first = await render(<OrdersScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
    await first.unmount();
    const refetch = jest.fn();
    orders.mockReturnValue({ status: 'error', message: '불러오지 못했어요.', refetch });
    const second = await render(<OrdersScreen />);
    await fireEvent.press(screen.getByText('다시 시도'));
    expect(refetch).toHaveBeenCalled();
    await second.unmount();
    orders.mockReturnValue({ status: 'offline', refetch });
    await render(<OrdersScreen />);
    expect(screen.getByText('인터넷에 연결되어 있지 않아요')).toBeOnTheScreen();
  });

  it('lists server orders with number, date and amount', async () => {
    orders.mockReturnValue({ status: 'success', data: [makeOrder()] });
    await render(<OrdersScreen />);
    expect(screen.getByText(/A-34/)).toBeOnTheScreen();
    expect(screen.getByText('아메리카노 2개')).toBeOnTheScreen();
    expect(screen.getByText('9,000원')).toBeOnTheScreen();
  });

  it('reorders from a past order using the current menu only', async () => {
    order.mockReturnValue({
      status: 'success',
      data: makeOrder({
        status: 'COMPLETED',
        lines: [
          {
            menuItemId: 'americano',
            name: '아메리카노',
            temperature: 'ICE',
            quantity: 2,
            unitPrice: 4500,
          },
          {
            menuItemId: 'vanilla-latte',
            name: '바닐라 라떼',
            temperature: 'HOT',
            quantity: 1,
            unitPrice: 5500,
          },
        ],
      }),
    });
    await render(<OrderDetailScreen />);
    await fireEvent.press(screen.getByLabelText('다시 주문'));
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'americano', temperature: 'ICE', quantity: 2 },
    ]);
  });

  it('shows the cancel button on the detail only while PAID', async () => {
    order.mockReturnValue({ status: 'success', data: makeOrder({ status: 'PAID' }) });
    const first = await render(<OrderDetailScreen />);
    expect(screen.getByLabelText('주문 취소')).toBeOnTheScreen();
    await first.unmount();
    order.mockReturnValue({ status: 'success', data: makeOrder({ status: 'READY' }) });
    await render(<OrderDetailScreen />);
    expect(screen.queryByLabelText('주문 취소')).not.toBeOnTheScreen();
  });
});
