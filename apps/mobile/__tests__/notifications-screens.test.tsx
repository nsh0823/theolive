import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NotificationsScreen from '../app/(tabs)/home/notifications';
import NotificationSettingsScreen from '../app/(tabs)/other/notification-settings';
import { NotificationBell } from '@/components/home/NotificationBell';
import {
  useMarkNotificationsReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useUnreadCount,
  useUpdateNotificationPreferencesMutation,
} from '@/hooks/useNotifications';
import type { AppNotification } from '@/models';

jest.mock('@/hooks/useNotifications', () => ({
  useNotificationsQuery: jest.fn(),
  useUnreadCount: jest.fn(),
  useMarkNotificationsReadMutation: jest.fn(),
  useNotificationPreferencesQuery: jest.fn(),
  useUpdateNotificationPreferencesMutation: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const ITEMS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'ORDER',
    title: '주문이 접수되었어요. (A-34)',
    at: '2026.11.04 13:51',
    isRead: false,
    orderId: 'order-1',
  },
  {
    id: 'n2',
    kind: 'STAMP',
    title: '올리브 스탬프 1개가 적립되었어요.',
    at: '2026.11.03 14:50',
    isRead: false,
    orderId: null,
  },
  {
    id: 'n3',
    kind: 'NOTICE',
    title: '11월 영업시간 안내',
    at: '2026.11.01 10:00',
    isRead: true,
    orderId: null,
  },
];

const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useNotificationsQuery).mockReturnValue({ status: 'success', data: ITEMS });
  jest.mocked(useMarkNotificationsReadMutation).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as never);
});

describe('Notifications screen', () => {
  it('lists the server notifications and filters by category', async () => {
    await render(<NotificationsScreen />);
    expect(screen.getByText('주문이 접수되었어요. (A-34)')).toBeOnTheScreen();
    expect(screen.getAllByText('새 알림')).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText('스탬프'));
    expect(screen.getByText('올리브 스탬프 1개가 적립되었어요.')).toBeOnTheScreen();
    expect(screen.queryByText('주문이 접수되었어요. (A-34)')).not.toBeOnTheScreen();
  });

  it('marks all read on the server', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByLabelText('모두 읽음으로 표시 (2)'));
    expect(mutate).toHaveBeenCalledWith(null);
  });

  it('marks one read and opens the order of an order message', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByLabelText(/^읽지 않음, 주문 알림/));
    expect(mutate).toHaveBeenCalledWith(['n1']);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/other/orders/[orderId]',
      params: { orderId: 'order-1' },
    });
  });

  it('does not mark a read notification again', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByLabelText(/^읽음, 공지 알림/));
    expect(mutate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('says so when marking fails', async () => {
    jest.mocked(useMarkNotificationsReadMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
    } as never);
    await render(<NotificationsScreen />);
    expect(screen.getByText(/읽음 처리에 실패했어요/)).toBeOnTheScreen();
  });

  it('shows empty, error with retry, loading and disconnected states', async () => {
    jest.mocked(useNotificationsQuery).mockReturnValue({ status: 'success', data: [] });
    const empty = await render(<NotificationsScreen />);
    expect(screen.getByText('새로운 알림이 없어요.')).toBeOnTheScreen();
    await empty.unmount();

    const refetch = jest.fn();
    jest
      .mocked(useNotificationsQuery)
      .mockReturnValue({ status: 'error', message: '불러오지 못했어요.', refetch });
    const failed = await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refetch).toHaveBeenCalled();
    await failed.unmount();

    jest.mocked(useNotificationsQuery).mockReturnValue({ status: 'loading' });
    const loading = await render(<NotificationsScreen />);
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
    await loading.unmount();

    jest.mocked(useNotificationsQuery).mockReturnValue({ status: 'offline', refetch });
    await render(<NotificationsScreen />);
    expect(screen.getByLabelText('다시 연결하기')).toBeOnTheScreen();
  });
});

describe('NotificationBell', () => {
  it('shows the unread count in its label', async () => {
    jest.mocked(useUnreadCount).mockReturnValue(3);
    await render(<NotificationBell />);
    expect(screen.getByLabelText('알림, 읽지 않은 알림 3개')).toBeOnTheScreen();
  });
  it('has a plain label without unread notifications', async () => {
    jest.mocked(useUnreadCount).mockReturnValue(0);
    await render(<NotificationBell />);
    expect(screen.getByLabelText('알림')).toBeOnTheScreen();
  });
});

describe('Notification settings', () => {
  const update = jest.fn();
  beforeEach(() => {
    jest.mocked(useNotificationPreferencesQuery).mockReturnValue({
      status: 'success',
      data: { orderUpdates: true, notices: true },
    });
    jest
      .mocked(useUpdateNotificationPreferencesMutation)
      .mockReturnValue({ mutate: update } as never);
  });

  it('sends the changed preference to the server', async () => {
    await render(<NotificationSettingsScreen />);
    await fireEvent(screen.getByLabelText('공지사항 알림'), 'valueChange', false);
    expect(update).toHaveBeenCalledWith({ orderUpdates: true, notices: false }, expect.any(Object));
    expect(screen.getByLabelText('공지사항 알림').props.value).toBe(false);
  });

  it('puts the switch back and says so when the server refuses', async () => {
    update.mockImplementation((_next, options: { onError: () => void }) => options.onError());
    await render(<NotificationSettingsScreen />);
    await act(async () => {
      await fireEvent(screen.getByLabelText('주문 상태 알림'), 'valueChange', false);
    });
    expect(screen.getByLabelText('주문 상태 알림').props.value).toBe(true);
    expect(screen.getByText(/설정을 저장하지 못했어요/)).toBeOnTheScreen();
  });

  it('shows an error with retry when the preferences cannot load', async () => {
    const refetch = jest.fn();
    jest
      .mocked(useNotificationPreferencesQuery)
      .mockReturnValue({ status: 'error', message: 'x', refetch });
    await render(<NotificationSettingsScreen />);
    await fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refetch).toHaveBeenCalled();
  });
});
