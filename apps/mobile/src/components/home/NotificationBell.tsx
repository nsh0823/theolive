import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useNotificationsQuery } from '@/fixtures/queries';
import { unreadCount } from '@/lib/notifications';
import { useNotificationStore } from '@/store/useNotificationStore';

import { AppIcon } from '../ui/AppIcon';

/** HOME-01: header entry to the notification list; a dot marks unread (label says so too). */
export function NotificationBell() {
  const router = useRouter();
  const state = useNotificationsQuery();
  const readIds = useNotificationStore((store) => store.readIds);
  const unread = state.status === 'success' ? unreadCount(state.data, readIds) : 0;
  return (
    <Pressable
      onPress={() => router.push('/home/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `알림, 읽지 않은 알림 ${unread}개` : '알림'}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-secondary"
    >
      <AppIcon icon={Bell} tone="primary" />
      {unread > 0 ? (
        <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border border-card bg-destructive" />
      ) : null}
    </Pressable>
  );
}
