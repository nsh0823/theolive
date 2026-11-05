import { fireEvent, render, screen } from '@testing-library/react-native';

import CartScreen from '../app/(tabs)/order/cart';
import OrderScreen from '../app/(tabs)/order/index';
import { useCartStore } from '@/store/useCartStore';
import { useCategoriesQuery, useMenuQuery } from '@/hooks/useMenu';
import { categoriesQueryDefault, menuQueryDefault } from '../test-utils/testMenu';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockClear();
  useCartStore.setState({ lines: [], orderType: 'TAKEOUT' });
});

const mockedMenu = jest.mocked(useMenuQuery);
const mockedCategories = jest.mocked(useCategoriesQuery);

describe('Order screen states', () => {
  afterEach(() => {
    mockedMenu.mockImplementation(menuQueryDefault);
    mockedCategories.mockImplementation(categoriesQueryDefault);
  });

  it('shows loading while the menu is fetched', async () => {
    mockedMenu.mockReturnValue({ status: 'loading' });
    await render(<OrderScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
  });

  it('shows the disconnected state and refetches when the customer retries', async () => {
    const refetch = jest.fn();
    mockedMenu.mockReturnValue({ status: 'offline', refetch });
    await render(<OrderScreen />);
    expect(screen.getByText('인터넷에 연결되어 있지 않아요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('다시 연결하기'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry for a server failure', async () => {
    const refetch = jest.fn();
    mockedCategories.mockReturnValue({
      status: 'error',
      message: '불러오지 못했어요.',
      refetch,
    });
    await render(<OrderScreen />);
    expect(screen.getByText('불러오지 못했어요.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('다시 시도'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when no item is orderable', async () => {
    mockedMenu.mockReturnValue({ status: 'success', data: [] });
    await render(<OrderScreen />);
    expect(screen.getByText('지금 주문할 수 있는 메뉴가 없어요.')).toBeOnTheScreen();
  });
});

describe('Order screen', () => {
  it('filters the menu by category', async () => {
    await render(<OrderScreen />);
    expect(screen.getByText('아메리카노')).toBeOnTheScreen();
    expect(screen.getByText('플레인 스콘')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('디저트'));
    expect(screen.queryByText('아메리카노')).not.toBeOnTheScreen();
    expect(screen.getByText('플레인 스콘')).toBeOnTheScreen();
  });

  it('labels sold-out items', async () => {
    await render(<OrderScreen />);
    expect(screen.getByLabelText(/바닐라 라떼.*품절/)).toBeOnTheScreen();
  });
});

describe('Cart screen', () => {
  it('shows the empty state', async () => {
    await render(<CartScreen />);
    expect(screen.getByText('장바구니가 비어 있어요.')).toBeOnTheScreen();
  });

  it('updates the displayed total when quantity changes', async () => {
    useCartStore.getState().addLine('americano', 'HOT', 1);
    await render(<CartScreen />);
    expect(screen.getAllByText('4,500원').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('아메리카노 HOT 수량 늘리기'));
    expect(screen.getAllByText('9,000원').length).toBeGreaterThan(0);
  });

  it('blocks ordering when a sold-out item is in the cart', async () => {
    useCartStore.getState().addLine('vanilla-latte', 'HOT', 1);
    await render(<CartScreen />);
    expect(screen.getByText('품절 · 삭제 후 주문해 주세요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('주문하기'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
