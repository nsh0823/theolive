import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/home/index';

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
});
