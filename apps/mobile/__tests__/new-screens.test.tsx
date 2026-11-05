import { fireEvent, render, screen } from '@testing-library/react-native';

import NotificationsScreen from '../app/(tabs)/home/notifications';
import SearchScreen from '../app/(tabs)/order/search';
import RewardScreen from '../app/(tabs)/reward/index';
import { useNotificationStore } from '@/store/useNotificationStore';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Search screen', () => {
  it('shows a prompt, results, and a no-result state', async () => {
    await render(<SearchScreen />);
    expect(screen.getByText(/메뉴 이름으로 찾아보세요/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('메뉴 검색어 입력'), '스콘');
    expect(screen.getByText('플레인 스콘')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('메뉴 검색어 입력'), '없는메뉴');
    expect(screen.getByText("'없는메뉴'에 대한 검색 결과가 없어요.")).toBeOnTheScreen();
  });
});

describe('Notifications screen', () => {
  beforeEach(() => useNotificationStore.setState({ readIds: [] }));

  it('marks everything read', async () => {
    await render(<NotificationsScreen />);
    expect(screen.getAllByText('새 알림').length).toBe(2);
    await fireEvent.press(screen.getByLabelText(/모두 읽음으로 표시/));
    expect(screen.queryByText('새 알림')).not.toBeOnTheScreen();
  });

  it('filters by category', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByLabelText('스탬프'));
    expect(screen.getByText('올리브 스탬프 1개가 적립되었어요.')).toBeOnTheScreen();
    expect(screen.queryByText('주문이 접수되었어요. (A-34)')).not.toBeOnTheScreen();
  });
});

describe('Reward screen', () => {
  it('shows stamps, coupons, and points in separate sections', async () => {
    await render(<RewardScreen />);
    expect(screen.getByLabelText(/올리브 스탬프 7개/)).toBeOnTheScreen();
    expect(screen.getByLabelText('쿠폰 포인트 잔액 12,000원')).toBeOnTheScreen();
    expect(screen.getByLabelText(/아메리카노 또는 라떼 쿠폰.*사용 가능/)).toBeOnTheScreen();
  });
});
