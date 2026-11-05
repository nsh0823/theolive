import { fireEvent, render, screen } from '@testing-library/react-native';

import ItemDetailScreen from '../app/(tabs)/order/item/[id]';
import SearchScreen from '../app/(tabs)/order/search';
import { useMenuItemQuery, useMenuQuery } from '@/hooks/useMenu';
import { useCartStore } from '@/store/useCartStore';
import { TEST_MENU, menuItemQueryDefault, menuQueryDefault } from '../test-utils/testMenu';

let mockItemId = 'americano';
jest.mock('@/hooks/useRouteParam', () => ({ useRouteParam: () => mockItemId }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const menuQuery = jest.mocked(useMenuQuery);
const itemQuery = jest.mocked(useMenuItemQuery);

afterEach(() => {
  menuQuery.mockImplementation(menuQueryDefault);
  itemQuery.mockImplementation(menuItemQueryDefault);
});

beforeEach(() => {
  mockItemId = 'americano';
  useCartStore.setState({ lines: [], orderType: 'TAKEOUT' });
});

describe('Search screen data states', () => {
  it('shows loading, disconnected and error states instead of results', async () => {
    menuQuery.mockReturnValue({ status: 'loading' });
    const first = await render(<SearchScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
    await first.unmount();

    const refetch = jest.fn();
    menuQuery.mockReturnValue({ status: 'offline', refetch });
    const second = await render(<SearchScreen />);
    expect(screen.getByText('인터넷에 연결되어 있지 않아요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('다시 연결하기'));
    expect(refetch).toHaveBeenCalledTimes(1);
    await second.unmount();

    menuQuery.mockReturnValue({ status: 'error', message: '불러오지 못했어요.', refetch });
    await render(<SearchScreen />);
    expect(screen.getByText('불러오지 못했어요.')).toBeOnTheScreen();
  });
});

describe('Item detail screen', () => {
  it('shows the server price and adds the chosen temperature to the cart as ids only', async () => {
    await render(<ItemDetailScreen />);
    expect(screen.getAllByText('4,500원').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('ICE'));
    await fireEvent.press(screen.getByLabelText('담기'));
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'americano', temperature: 'ICE', quantity: 1 },
    ]);
  });

  it('blocks ordering a sold-out item', async () => {
    mockItemId = 'vanilla-latte';
    await render(<ItemDetailScreen />);
    expect(screen.getByText('품절된 메뉴예요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('담기'));
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('hides the temperature choice for an item without one and adds it with no temperature', async () => {
    mockItemId = 'bottled-water';
    await render(<ItemDetailScreen />);
    expect(screen.queryByLabelText('온도 선택')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('담기'));
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'bottled-water', temperature: null, quantity: 1 },
    ]);
  });

  it('says so when the item no longer exists (hidden or archived on the server)', async () => {
    mockItemId = 'gone';
    itemQuery.mockReturnValue({ status: 'success', data: null });
    await render(<ItemDetailScreen />);
    expect(screen.getByText('메뉴를 찾을 수 없어요.')).toBeOnTheScreen();
  });

  it('shows loading and the disconnected state', async () => {
    itemQuery.mockReturnValue({ status: 'loading' });
    const first = await render(<ItemDetailScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
    await first.unmount();
    itemQuery.mockReturnValue({ status: 'offline', refetch: jest.fn() });
    await render(<ItemDetailScreen />);
    expect(screen.getByText('인터넷에 연결되어 있지 않아요')).toBeOnTheScreen();
  });

  it('keeps the seeded test menu consistent with the sold-out fixture', () => {
    expect(TEST_MENU.find((item) => item.id === 'vanilla-latte')?.isSoldOut).toBe(true);
  });
});
