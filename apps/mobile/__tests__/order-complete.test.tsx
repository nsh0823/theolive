import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError } from '@theolive/api';

import CompleteScreen from '../app/(tabs)/order/complete/[orderId]';
import { useOrderQuery } from '@/hooks/useOrders';
import { makeOrder } from '../test-utils/testOrders';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/useRouteParam', () => ({ useRouteParam: () => 'order-1' }));
const mockCancel = jest.fn();
const mockRecover = jest.fn();
jest.mock('@/hooks/useOrders', () => ({
  useOrderQuery: jest.fn(),
  useRecoverPayment: (...args: unknown[]) => mockRecover(...args),
  useCancelOrderMutation: () => ({ mutateAsync: mockCancel, isPending: false }),
}));

const orderQuery = jest.mocked(useOrderQuery);
const show = (order: ReturnType<typeof makeOrder>) =>
  orderQuery.mockReturnValue({ status: 'success', data: order });

beforeEach(() => jest.clearAllMocks());

describe('order complete screen (server state)', () => {
  it('shows the number and a cancel button only while PAID', async () => {
    show(makeOrder({ status: 'PAID' }));
    await render(<CompleteScreen />);
    expect(screen.getByText('A-34')).toBeOnTheScreen();
    expect(screen.getByText('결제가 완료되었어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('주문 취소')).toBeOnTheScreen();
  });

  it.each(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'] as const)(
    'hides the cancel button once the order is %s',
    async (status) => {
      show(makeOrder({ status }));
      await render(<CompleteScreen />);
      expect(screen.queryByLabelText('주문 취소')).not.toBeOnTheScreen();
    },
  );

  it('asks first, then cancels with the expected PAID status', async () => {
    show(makeOrder({ status: 'PAID' }));
    mockCancel.mockResolvedValue(undefined);
    await render(<CompleteScreen />);
    await fireEvent.press(screen.getByLabelText('주문 취소'));
    expect(mockCancel).not.toHaveBeenCalled();
    expect(screen.getByText('주문을 취소할까요?')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByLabelText('주문 취소').at(-1) ?? screen.getByLabelText('주문 취소'),
    );
    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith({ orderId: 'order-1', expectedStatus: 'PAID' }),
    );
  });

  it('explains a status that changed meanwhile instead of failing silently', async () => {
    show(makeOrder({ status: 'PAID' }));
    mockCancel.mockRejectedValue(new AppError('INVALID_TRANSITION'));
    await render(<CompleteScreen />);
    await fireEvent.press(screen.getByLabelText('주문 취소'));
    await fireEvent.press(
      screen.getAllByLabelText('주문 취소').at(-1) ?? screen.getByLabelText('주문 취소'),
    );
    expect(await screen.findByText('현재 상태에서는 처리할 수 없는 작업이에요.')).toBeOnTheScreen();
  });

  it('shows the reject reason and refund in progress, then refunded', async () => {
    show(makeOrder({ status: 'REJECTED', paymentStatus: 'PAID', rejectReasonCode: 'SOLD_OUT' }));
    const first = await render(<CompleteScreen />);
    expect(screen.getByText('주문이 거절되었어요')).toBeOnTheScreen();
    expect(screen.getByText('거절 사유: 재료가 소진되었어요')).toBeOnTheScreen();
    expect(screen.getByText('환불 진행 중')).toBeOnTheScreen();
    await first.unmount();
    show(
      makeOrder({
        status: 'REJECTED',
        paymentStatus: 'REFUNDED',
        rejectReasonCode: 'OTHER',
        rejectReason: '정전',
      }),
    );
    await render(<CompleteScreen />);
    expect(screen.getByText('거절 사유: 정전')).toBeOnTheScreen();
    expect(screen.getByText('환불 완료')).toBeOnTheScreen();
  });

  it('while the payment is unconfirmed it asks the server to settle it', async () => {
    show(makeOrder({ status: 'PENDING_PAYMENT', paymentStatus: 'READY', orderNumber: null }));
    await render(<CompleteScreen />);
    expect(screen.getByText('결제를 확인하고 있어요')).toBeOnTheScreen();
    expect(mockRecover).toHaveBeenCalledWith('order-1', true);
  });

  it('shows the disconnected state with a retry', async () => {
    const refetch = jest.fn();
    orderQuery.mockReturnValue({ status: 'offline', refetch });
    await render(<CompleteScreen />);
    await fireEvent.press(screen.getByText('다시 연결하기'));
    expect(refetch).toHaveBeenCalled();
  });
});
