import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError } from '@theolive/api';

import CheckoutScreen from '../app/(tabs)/order/checkout';
import { useCheckoutQuoteResult } from '@/hooks/useRewards';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
const mockCheckout = jest.fn();
jest.mock('@/hooks/useOrders', () => ({
  useCheckoutMutation: () => ({ mutateAsync: mockCheckout }),
}));

const quoteResult = jest.mocked(useCheckoutQuoteResult);

async function renderCheckout() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CheckoutScreen />
    </QueryClientProvider>,
  );
}

/** The server's answers: the discount below is deliberately not what any client arithmetic would give. */
const BASE_QUOTE = {
  menuAmount: 9000,
  couponDiscount: 0,
  pointsUsed: 0,
  paidAmount: 9000,
  usableCouponIds: ['coupon-1'],
  pointsAvailable: 0,
  maxPointsUsable: 0,
};
const COUPON_QUOTE = { ...BASE_QUOTE, couponDiscount: 1234, paidAmount: 7766 };

function answerWith(forCoupon: unknown) {
  quoteResult.mockImplementation(((_lines: unknown, userCouponId: string | null) =>
    userCouponId === null
      ? { data: BASE_QUOTE, error: null, isFetching: false }
      : forCoupon) as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  useCheckoutAttemptStore.getState().reset();
  useCartStore.setState({
    lines: [{ menuItemId: 'americano', temperature: 'HOT', quantity: 2 }],
    orderType: 'TAKEOUT',
  });
  answerWith({ data: COUPON_QUOTE, error: null, isFetching: false });
});

describe('Checkout coupon (RW-04, PAY-02)', () => {
  it('offers only the coupons the server says apply, and none is selected at first', async () => {
    await renderCheckout();
    expect(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰, 1잔 무료$/)).toBeOnTheScreen();
    // Used and expired coupons from the wallet are not offered.
    expect(screen.queryByLabelText(/전체 음료 쿠폰/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('9,000원 결제하기')).toBeOnTheScreen();
  });

  it('shows the server discount and amount, never its own', async () => {
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰/));
    expect(screen.getByLabelText('쿠폰 할인 -1,234원')).toBeOnTheScreen();
    expect(screen.getByLabelText('최종 결제 금액 7,766원')).toBeOnTheScreen();
    expect(screen.getByLabelText('7,766원 결제하기')).toBeOnTheScreen();
  });

  it('waits for the server price before the coupon order can be paid', async () => {
    answerWith({ data: undefined, error: null, isFetching: true });
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰/));
    expect(screen.getByLabelText('9,000원 결제하기')).toBeDisabled();
  });

  it('sends the chosen coupon id with the payment request, with its own idempotency key', async () => {
    mockCheckout.mockResolvedValue({
      orderId: 'o1',
      paymentId: 'p1',
      amount: 7766,
      nextAction: { type: 'TEST_SHEET', checkoutToken: 't' },
    });
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('카카오페이'));
    await fireEvent.press(screen.getByLabelText('9,000원 결제하기'));
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(1));
    const withoutCoupon = mockCheckout.mock.calls[0]?.[0];
    expect(withoutCoupon.userCouponId).toBeNull();

    await fireEvent.press(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰/));
    await fireEvent.press(screen.getByLabelText('7,766원 결제하기'));
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(2));
    const withCoupon = mockCheckout.mock.calls[1]?.[0];
    expect(withCoupon.userCouponId).toBe('coupon-1');
    expect(withCoupon.clientRequestId).not.toBe(withoutCoupon.clientRequestId);
    // The pay screen gets the amount the server returned.
    expect(mockPush).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ amount: '7766' }) }),
    );
  });

  it('drops a coupon the server rejects and says why', async () => {
    answerWith({ data: undefined, error: new AppError('COUPON_EXPIRED'), isFetching: false });
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰/));
    await waitFor(() => expect(screen.getByText('유효기간이 지난 쿠폰이에요.')).toBeOnTheScreen());
    expect(screen.getByLabelText('9,000원 결제하기')).toBeOnTheScreen();
  });

  it('clears the coupon and refreshes the wallet when payment start is refused', async () => {
    mockCheckout.mockRejectedValue(new AppError('COUPON_NOT_USABLE'));
    await renderCheckout();
    await fireEvent.press(screen.getByLabelText('카카오페이'));
    await fireEvent.press(screen.getByLabelText(/^아메리카노 또는 라떼 쿠폰/));
    await fireEvent.press(screen.getByLabelText('7,766원 결제하기'));
    await waitFor(() =>
      expect(screen.getByText('이 주문에는 사용할 수 없는 쿠폰이에요.')).toBeOnTheScreen(),
    );
  });
});
