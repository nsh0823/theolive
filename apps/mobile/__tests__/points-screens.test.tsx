import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppError, PointCodeRejectedError } from '@theolive/api';

import PointCodeScreen from '../app/(tabs)/reward/point-code';
import PointsScreen from '../app/(tabs)/reward/points';
import { useRegisterPointCodeMutation, usePointsQuery } from '@/hooks/usePoints';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mutation = jest.mocked(useRegisterPointCodeMutation);
const points = jest.mocked(usePointsQuery);

function registerWith(mutateAsync: jest.Mock) {
  mutation.mockReturnValue({ mutateAsync } as never);
}

async function enterAndSubmit(code: string) {
  await fireEvent.changeText(screen.getByLabelText('포인트 코드 입력'), code);
  await fireEvent.press(screen.getByLabelText('등록하기'));
}

describe('Point code screen (RW-05, RW-08)', () => {
  it('registers a code and shows the credited points', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ amount: 5000, balance: 17000 });
    registerWith(mutateAsync);
    await render(<PointCodeScreen />);
    await enterAndSubmit(' olive-ab23-cd45 ');
    await waitFor(() => expect(screen.getByText('등록 완료')).toBeOnTheScreen());
    expect(mutateAsync).toHaveBeenCalledWith('olive-ab23-cd45');
    expect(screen.getByText(/5,000원이 적립되었어요/)).toBeOnTheScreen();
    expect(screen.getByLabelText('포인트 내역 보기')).toBeOnTheScreen();
  });

  it.each([
    ['CODE_INVALID', '올바르지 않은 코드예요. 코드를 다시 확인해 주세요.'],
    ['CODE_ALREADY_REGISTERED', '이미 사용된 코드예요.'],
    ['CODE_EXPIRED', '유효기간이 지난 코드예요.'],
  ] as const)('explains %s without leaving the screen', async (code, message) => {
    registerWith(jest.fn().mockRejectedValue(new AppError(code)));
    await render(<PointCodeScreen />);
    await enterAndSubmit('OLIVE-AAAA-BBBB');
    await waitFor(() => expect(screen.getByText(message)).toBeOnTheScreen());
    expect(screen.getByText('등록 실패')).toBeOnTheScreen();
  });

  it('tells the member how long to wait when rate limited', async () => {
    registerWith(jest.fn().mockRejectedValue(new PointCodeRejectedError('TOO_MANY_ATTEMPTS', 600)));
    await render(<PointCodeScreen />);
    await enterAndSubmit('OLIVE-AAAA-BBBB');
    await waitFor(() =>
      expect(
        screen.getByText('코드를 여러 번 잘못 입력했어요. 10분 뒤에 다시 시도해 주세요.'),
      ).toBeOnTheScreen(),
    );
  });

  it('does not call the server for an empty code', async () => {
    const mutateAsync = jest.fn();
    registerWith(mutateAsync);
    await render(<PointCodeScreen />);
    expect(screen.getByLabelText('등록하기')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('등록하기'));
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe('Points screen (RW-06)', () => {
  it('shows the balance, what is held, and a ledger with the end date of added points', async () => {
    points.mockReturnValue({
      status: 'success',
      data: { balance: 12000, held: 3000, available: 9000, nextExpiresAt: '2027-02-04T15:00:00Z' },
    });
    await render(<PointsScreen />);
    expect(
      screen.getByLabelText('쿠폰 포인트 잔액 12,000원, 결제 진행 중 3,000원'),
    ).toBeOnTheScreen();
    expect(screen.getByText('가장 빠른 유효기간 2027.02.04')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/적립 코드 등록 \+15,000원 유효기간 2027.02.04까지/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/사용 주문 결제 -3,000원/)).toBeOnTheScreen();
  });

  it('shows the error and offline states instead of a zero balance', async () => {
    points.mockReturnValue({ status: 'error', message: '불러오지 못했어요.', refetch: jest.fn() });
    await render(<PointsScreen />);
    expect(screen.queryByLabelText(/쿠폰 포인트 잔액/)).not.toBeOnTheScreen();
  });
});
