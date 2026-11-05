import { fireEvent, render, screen } from '@testing-library/react-native';

import SearchScreen from '../app/(tabs)/order/search';
import RewardScreen from '../app/(tabs)/reward/index';

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

describe('Reward screen', () => {
  it('shows stamps, coupons, and points in separate sections', async () => {
    await render(<RewardScreen />);
    expect(screen.getByLabelText(/올리브 스탬프 7개/)).toBeOnTheScreen();
    expect(screen.getByLabelText('쿠폰 포인트 잔액 12,000원')).toBeOnTheScreen();
    expect(screen.getByLabelText(/아메리카노 또는 라떼 쿠폰.*사용 가능/)).toBeOnTheScreen();
  });
});
