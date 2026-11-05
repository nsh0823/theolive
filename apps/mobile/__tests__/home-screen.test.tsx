import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/home/index';
import { useOrdersQuery } from '@/hooks/useOrders';
import { makeOrder } from '../test-utils/testOrders';

jest.mock('@/hooks/useOrders', () => ({ useOrdersQuery: jest.fn() }));
const orders = jest.mocked(useOrdersQuery);
beforeEach(() => orders.mockReturnValue({ status: 'success', data: [makeOrder()] }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Home screen', () => {
  it('has no logo and keeps stamps, coupons, and points as separate shortcuts', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByTestId('brand-logo')).not.toBeOnTheScreen();
    expect(screen.getByLabelText(/^스탬프 \d+개$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^쿠폰 \d+장$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^포인트 [\d,]+원$/)).toBeOnTheScreen();
  });

  it('ends with the reward CTA the tab bar used to cover', async () => {
    await render(<HomeScreen />);
    expect(screen.getByLabelText('리워드 전체 보기')).toBeOnTheScreen();
  });

  it("offers quick reorder from the customer's real orders, or an empty state", async () => {
    const first = await render(<HomeScreen />);
    expect(screen.getByLabelText('아메리카노 다시 주문')).toBeOnTheScreen();
    await first.unmount();
    orders.mockReturnValue({ status: 'success', data: [] });
    await render(<HomeScreen />);
    expect(screen.getByText('아직 주문한 메뉴가 없어요.')).toBeOnTheScreen();
  });
});
