import { fireEvent, render, screen } from '@testing-library/react-native';

import NoticeDetailScreen from '../app/(tabs)/other/notices/[id]';
import NoticesScreen from '../app/(tabs)/other/notices/index';
import { useNoticeQuery, useNoticesQuery } from '@/hooks/useNotices';

jest.mock('@/hooks/useNotices', () => ({ useNoticesQuery: jest.fn(), useNoticeQuery: jest.fn() }));
jest.mock('@/hooks/useRouteParam', () => ({ useRouteParam: () => 'nt1' }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const NOTICE = {
  id: 'nt1',
  title: '11월 영업시간 안내',
  body: '본문입니다.',
  publishedAt: '2026.11.01',
};

describe('Notices list', () => {
  it('lists published notices and opens one', async () => {
    jest.mocked(useNoticesQuery).mockReturnValue({ status: 'success', data: [NOTICE] });
    await render(<NoticesScreen />);
    await fireEvent.press(screen.getByLabelText('11월 영업시간 안내, 2026.11.01'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/other/notices/[id]',
      params: { id: 'nt1' },
    });
  });
  it('shows the empty state', async () => {
    jest.mocked(useNoticesQuery).mockReturnValue({ status: 'success', data: [] });
    await render(<NoticesScreen />);
    expect(screen.getByText('등록된 공지사항이 없어요.')).toBeOnTheScreen();
  });
  it('shows an error with retry', async () => {
    const refetch = jest.fn();
    jest.mocked(useNoticesQuery).mockReturnValue({ status: 'error', message: 'x', refetch });
    await render(<NoticesScreen />);
    await fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('Notice detail', () => {
  it('shows title, date and body', async () => {
    jest.mocked(useNoticeQuery).mockReturnValue({ status: 'success', data: NOTICE });
    await render(<NoticeDetailScreen />);
    expect(screen.getByText('11월 영업시간 안내')).toBeOnTheScreen();
    expect(screen.getByText('본문입니다.')).toBeOnTheScreen();
  });
  it('says so when the notice does not exist or is not published', async () => {
    jest.mocked(useNoticeQuery).mockReturnValue({ status: 'success', data: null });
    await render(<NoticeDetailScreen />);
    expect(screen.getByText('공지사항을 찾을 수 없어요.')).toBeOnTheScreen();
  });
  it('shows loading', async () => {
    jest.mocked(useNoticeQuery).mockReturnValue({ status: 'loading' });
    await render(<NoticeDetailScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
  });
});
