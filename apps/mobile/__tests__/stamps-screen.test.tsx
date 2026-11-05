import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError } from '@theolive/api';

import StampsScreen from '../app/(tabs)/reward/stamps';
import { useRedeemStampsMutation, useStampsQuery } from '@/hooks/useRewards';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const mockRedeem = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRedeemStampsMutation).mockReturnValue({ mutateAsync: mockRedeem } as never);
});

async function exchange(label: string) {
  await fireEvent.press(screen.getByLabelText(label));
  await fireEvent.press(screen.getByText('교환하기'));
}

describe('Stamps screen (RW-01, RW-02)', () => {
  it('shows the balance, the exchange rules and the ledger', async () => {
    await render(<StampsScreen />);
    expect(screen.getByLabelText(/올리브 스탬프 7개/)).toBeOnTheScreen();
    expect(screen.getByText('주문 적립', { exact: false })).toBeOnTheScreen();
    expect(screen.getByLabelText(/사용 쿠폰 교환 -10개/)).toBeOnTheScreen();
  });

  it('only lets the customer exchange a rule the balance covers (7 stamps: 5 yes, 10 no)', async () => {
    await render(<StampsScreen />);
    expect(screen.getByLabelText('정액 쿠폰 교환하기')).toBeEnabled();
    expect(screen.getByLabelText('아메리카노 또는 라떼 쿠폰 교환하기')).toBeDisabled();
  });

  it('exchanges through the server with one request id and says so', async () => {
    mockRedeem.mockResolvedValue({ userCouponId: 'coupon-9', stampBalance: 2, isReplay: false });
    await render(<StampsScreen />);
    await exchange('정액 쿠폰 교환하기');
    await waitFor(() => expect(screen.getByText('정액 쿠폰으로 교환했어요.')).toBeOnTheScreen());
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(mockRedeem).toHaveBeenCalledWith({
      couponId: 'rule-5',
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await fireEvent.press(screen.getByLabelText('내 쿠폰 보기'));
    expect(mockPush).toHaveBeenCalledWith('/reward/coupons');
  });

  it('shows the server reason when the exchange is refused and uses a new request id next time', async () => {
    mockRedeem
      .mockRejectedValueOnce(new AppError('INSUFFICIENT_STAMPS'))
      .mockResolvedValueOnce({ userCouponId: 'c', stampBalance: 0, isReplay: false });
    await render(<StampsScreen />);
    await exchange('정액 쿠폰 교환하기');
    await waitFor(() => expect(screen.getByText('스탬프가 부족해요.')).toBeOnTheScreen());
    await exchange('정액 쿠폰 교환하기');
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(2));
    const [first, second] = mockRedeem.mock.calls.map((call) => call[0].clientRequestId);
    expect(second).not.toBe(first);
  });

  it('keeps the request id after a lost connection so a retry cannot exchange twice', async () => {
    mockRedeem
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ userCouponId: 'c', stampBalance: 2, isReplay: true });
    await render(<StampsScreen />);
    await exchange('정액 쿠폰 교환하기');
    await waitFor(() => expect(screen.getByText(/인터넷/)).toBeOnTheScreen());
    await exchange('정액 쿠폰 교환하기');
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(2));
    const [first, second] = mockRedeem.mock.calls.map((call) => call[0].clientRequestId);
    expect(second).toBe(first);
  });

  it('shows the disconnected state with a retry', async () => {
    const refetch = jest.fn();
    jest.mocked(useStampsQuery).mockReturnValue({ status: 'offline', refetch });
    await render(<StampsScreen />);
    await fireEvent.press(screen.getByText('다시 연결하기'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
