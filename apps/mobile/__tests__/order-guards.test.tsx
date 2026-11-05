import { fireEvent, render, screen } from '@testing-library/react-native';

import CartScreen from '../app/(tabs)/order/cart';
import ItemDetailScreen from '../app/(tabs)/order/item/[id]';
import { StoreClosedBanner } from '@/components/order/StoreClosedBanner';
import { useOrderAvailability } from '@/hooks/useStoreStatus';
import { NOT_ACCEPTING_MESSAGE, STORE_CLOSED_MESSAGE } from '@/lib/storeAvailability';
import { useCartStore } from '@/store/useCartStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/useRouteParam', () => ({ useRouteParam: () => 'americano' }));

const availability = jest.mocked(useOrderAvailability);
const open = { canOrder: true, message: null };

beforeEach(() => {
  jest.clearAllMocks();
  availability.mockReturnValue(open);
  useCartStore.setState({ lines: [], removedCount: 0, orderType: 'TAKEOUT' });
});

describe('store closed / not accepting banner', () => {
  it('renders nothing while the store takes orders', async () => {
    await render(<StoreClosedBanner />);
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it.each([STORE_CLOSED_MESSAGE, NOT_ACCEPTING_MESSAGE])('shows "%s"', async (message) => {
    availability.mockReturnValue({ canOrder: false, message });
    await render(<StoreClosedBanner />);
    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  it('disables adding to the cart on the item screen', async () => {
    availability.mockReturnValue({ canOrder: false, message: STORE_CLOSED_MESSAGE });
    await render(<ItemDetailScreen />);
    expect(screen.getByText(STORE_CLOSED_MESSAGE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('담기'));
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('disables ordering from the cart', async () => {
    availability.mockReturnValue({ canOrder: false, message: NOT_ACCEPTING_MESSAGE });
    useCartStore.getState().addLine('americano', 'HOT', 1);
    await render(<CartScreen />);
    await fireEvent.press(screen.getByLabelText('주문하기'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('cart against the live menu', () => {
  it('removes lines whose item is gone from the cart itself and says so', async () => {
    useCartStore.getState().addLine('americano', 'HOT', 1);
    useCartStore.getState().addLine('archived-item', 'HOT', 1);
    await render(<CartScreen />);
    expect(useCartStore.getState().lines.map((l) => l.menuItemId)).toEqual(['americano']);
    expect(screen.getByText(/1개를 장바구니에서 뺐어요/)).toBeOnTheScreen();
  });

  it('flags sold-out lines, blocks ordering, and removes them with one tap', async () => {
    useCartStore.getState().addLine('americano', 'HOT', 1);
    useCartStore.getState().addLine('vanilla-latte', 'HOT', 1);
    await render(<CartScreen />);
    await fireEvent.press(screen.getByLabelText('주문하기'));
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('품절된 메뉴 모두 삭제'));
    expect(useCartStore.getState().lines.map((l) => l.menuItemId)).toEqual(['americano']);
    await fireEvent.press(screen.getByLabelText('주문하기'));
    expect(mockPush).toHaveBeenCalledWith('/order/order-type');
  });
});
