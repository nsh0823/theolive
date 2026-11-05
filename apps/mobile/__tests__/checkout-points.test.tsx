import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError } from '@theolive/api';

import CheckoutScreen from '../app/(tabs)/order/checkout';
import { useCheckoutQuoteResult } from '@/hooks/useRewards';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
const mockCheckout = jest.fn();
jest.mock('@/hooks/useOrders', () => ({
  useCheckoutMutation: () => ({ mutateAsync: mockCheckout }),
}));

const quoteResult = jest.mocked(useCheckoutQuoteResult);

async function renderCheckout() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckoutScreen />
    </QueryClientProvider>,
  );
}

/**
 * The server's answers. The applied points below are deliberately not what a client sum would give, to prove the
 * screen shows (and sends) the server's number: asked for 99,999 it applies 5,000 of the 12,000 available.
 */
const QUOTE = {
  menuAmount: 9000,
  couponDiscount: 0,
  usableCouponIds: [] as string[],
  pointsAvailable: 12000,
  maxPointsUsable: 5000,
};
const quoteFor = (pointsToUse: number) => {
  const pointsUsed = Math.min(pointsToUse, QUOTE.maxPointsUsable);
  return {
    data: { ...QUOTE, pointsUsed, paidAmount: 9000 - pointsUsed },
    error: null,
    isFetching: false,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  useCheckoutAttemptStore.getState().reset();
  useCartStore.setState({
    lines: [{ menuItemId: 'americano', temperature: 'HOT', quantity: 2 }],
    orderType: 'TAKEOUT',
  });
  quoteResult.mockImplementation(((_l: unknown, _c: unknown, points: number) =>
    quoteFor(points)) as never);
});

describe('Checkout Coupon Points (PAY-03)', () => {
  it('shows the available points and applies nothing until asked', async () => {
    await renderCheckout();
    expect(screen.getByText('사용 가능 12,000원')).toBeOnTheScreen();
    expect(screen.getByLabelText('포인트 사용 0원')).toBeOnTheScreen();
    expect(screen.getByLabelText('9,000원 결제하기')).toBeOnTheScreen();
  });

  it('shows what the server applied when the request was more than allowed', async () => {
    await renderCheckout();
    await fireEvent.changeText(screen.getByLabelText('사용할 포인트 금액'), '99999');
    await fireEvent.press(screen.getByLabelText('포인트 적용'));
    expect(quoteResult).toHaveBeenCalledWith(expect.anything(), null, 99999);
    expect(screen.getByLabelText('포인트 사용 -5,000원')).toBeOnTheScreen();
    expect(screen.getByLabelText('최종 결제 금액 4,000원')).toBeOnTheScreen();
    expect(screen.getByText(/최대 5,000원까지 사용할 수 있어요/)).toBeOnTheScreen();
  });

  it('"use all" asks for the most the server says can be used', async () => {
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('포인트 모두 사용'));
    expect(screen.getByLabelText('포인트 사용 -5,000원')).toBeOnTheScreen();
    expect(screen.getByLabelText('4,000원 결제하기')).toBeOnTheScreen();
  });

  it('waits for the server price before an order with points can be paid', async () => {
    quoteResult.mockImplementation(((_l: unknown, _c: unknown, points: number) =>
      points === 0 ? quoteFor(0) : { data: undefined, error: null, isFetching: true }) as never);
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('포인트 모두 사용'));
    expect(screen.getByLabelText('9,000원 결제하기')).toBeDisabled();
  });

  it('sends the points the server applied, with its own idempotency key', async () => {
    mockCheckout.mockResolvedValue({
      orderId: 'o1',
      paymentId: 'p1',
      amount: 4000,
      nextAction: { type: 'TEST_SHEET', checkoutToken: 't' },
    });
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('카카오페이'));
    await fireEvent.press(screen.getByLabelText('9,000원 결제하기'));
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(1));
    const plain = mockCheckout.mock.calls[0]?.[0];
    expect(plain.pointsToUse).toBe(0);

    await fireEvent.changeText(screen.getByLabelText('사용할 포인트 금액'), '99999');
    await fireEvent.press(screen.getByLabelText('포인트 적용'));
    await fireEvent.press(screen.getByLabelText('4,000원 결제하기'));
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(2));
    const withPoints = mockCheckout.mock.calls[1]?.[0];
    // 5,000 (the server's clamp), never the typed 99,999.
    expect(withPoints.pointsToUse).toBe(5000);
    expect(withPoints.clientRequestId).not.toBe(plain.clientRequestId);
  });

  it('can drop the points again', async () => {
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('포인트 모두 사용'));
    await fireEvent.press(screen.getByLabelText('포인트 사용 안 함'));
    expect(screen.getByLabelText('9,000원 결제하기')).toBeOnTheScreen();
  });

  it('says so in plain language when the balance changed under the order', async () => {
    mockCheckout.mockRejectedValue(new AppError('POINTS_EXCEED_BALANCE'));
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('카카오페이'));
    await fireEvent.press(screen.getByLabelText('포인트 모두 사용'));
    await fireEvent.press(screen.getByLabelText('4,000원 결제하기'));
    await waitFor(() =>
      expect(screen.getByText('사용할 수 있는 포인트보다 많아요.')).toBeOnTheScreen(),
    );
  });
});
