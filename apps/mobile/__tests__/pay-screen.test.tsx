import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError } from '@theolive/api';

import PayScreen from '../app/(tabs)/order/pay';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }),
}));
jest.mock('@/hooks/useRouteParam', () => ({
  useRouteParam: (name: string) =>
    ({ orderId: 'order-1', paymentId: 'pay-1', checkoutToken: 'token', amount: '9000' })[name] ??
    null,
}));
const mockTestPay = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@/hooks/useOrders', () => ({
  useTestPaymentMutation: () => ({ mutateAsync: mockTestPay }),
  useConfirmPaymentMutation: () => ({ mutateAsync: mockConfirm }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, { __DEV__: true });
  useCartStore.setState({ lines: [{ menuItemId: 'americano', temperature: 'HOT', quantity: 1 }] });
  useCheckoutAttemptStore.getState().idFor('x');
});

describe('TEST payment screen (not real payment)', () => {
  it('says plainly that this is a test and shows the server amount', async () => {
    await render(<PayScreen />);
    expect(screen.getByText('테스트 결제')).toBeOnTheScreen();
    expect(screen.getByText(/돈이 빠져나가지 않아요/)).toBeOnTheScreen();
    expect(screen.getByText('9,000원')).toBeOnTheScreen();
  });

  it('offers approve, fail and cancel everywhere; the edge-case scenarios only in dev builds', async () => {
    Object.assign(globalThis, { __DEV__: false });
    const release = await render(<PayScreen />);
    expect(screen.getByLabelText('승인')).toBeOnTheScreen();
    expect(screen.getByLabelText('실패')).toBeOnTheScreen();
    expect(screen.getByLabelText('취소')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/웹훅만/)).not.toBeOnTheScreen();
    await release.unmount();
    Object.assign(globalThis, { __DEV__: true });
    await render(<PayScreen />);
    expect(screen.getByLabelText(/웹훅만/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/금액 불일치/)).toBeOnTheScreen();
  });

  it('confirms an approval with the server and then shows the order, clearing the cart', async () => {
    mockTestPay.mockResolvedValue({ result: 'APPROVED', providerPaymentKey: 'key-1' });
    mockConfirm.mockResolvedValue({ orderStatus: 'PAID' });
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText('승인'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockTestPay).toHaveBeenCalledWith({ checkoutToken: 'token', scenario: 'SUCCESS' });
    expect(mockConfirm).toHaveBeenCalledWith({ paymentId: 'pay-1', providerPaymentKey: 'key-1' });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/order/complete/[orderId]',
      params: { orderId: 'order-1' },
    });
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('a webhook-only approval skips confirm and lets the order screen show the server state', async () => {
    mockTestPay.mockResolvedValue({ result: 'APPROVED', providerPaymentKey: null });
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText(/웹훅만/));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('a failed payment keeps the cart, explains, and starts a new attempt on retry', async () => {
    mockTestPay.mockResolvedValue({ result: 'FAILED', providerPaymentKey: null });
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText('실패'));
    expect(await screen.findByText(/결제에 실패했어요/)).toBeOnTheScreen();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCheckoutAttemptStore.getState().clientRequestId).toBeNull();
    await fireEvent.press(screen.getByLabelText('다시 결제하기'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('cannot be submitted twice while a request is running', async () => {
    mockTestPay.mockReturnValue(new Promise(() => undefined));
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText('승인'));
    await fireEvent.press(screen.getByLabelText('승인'));
    await fireEvent.press(screen.getByLabelText('실패'));
    expect(mockTestPay).toHaveBeenCalledTimes(1);
  });

  it('offers to re-check after a network error without paying again', async () => {
    mockTestPay.mockResolvedValue({ result: 'APPROVED', providerPaymentKey: 'key-1' });
    mockConfirm.mockRejectedValueOnce(new Error('Network request failed'));
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText('승인'));
    expect(await screen.findByText(/인터넷 연결을 확인/)).toBeOnTheScreen();
    mockConfirm.mockResolvedValue({ orderStatus: 'PAID' });
    await fireEvent.press(screen.getByLabelText('결제 확인 다시 시도'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockTestPay).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledTimes(2);
  });

  it('hands over to the order screen when the server already settled the payment', async () => {
    mockTestPay.mockResolvedValue({ result: 'APPROVED', providerPaymentKey: 'key-1' });
    mockConfirm.mockRejectedValue(new AppError('PAYMENT_EXPIRED'));
    await render(<PayScreen />);
    await fireEvent.press(screen.getByLabelText(/늦은 승인/));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });
});
