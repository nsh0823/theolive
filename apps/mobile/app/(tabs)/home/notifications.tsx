import { BellOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { NotificationItem } from '@/components/home/NotificationItem';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { CtaButton } from '@/components/ui/CtaButton';
import { EmptyView } from '@/components/ui/StateViews';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNotificationsQuery } from '@/fixtures/queries';
import {
  NOTIFICATION_FILTERS,
  filterNotifications,
  isNotificationRead,
  unreadCount,
  type NotificationFilter,
} from '@/lib/notifications';
import type { AppNotification } from '@/models';
import { useNotificationStore } from '@/store/useNotificationStore';

function NotificationList({ items }: { items: AppNotification[] }) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const { readIds, markRead, markAllRead } = useNotificationStore();
  const visible = filterNotifications(items, filter);
  const unread = unreadCount(items, readIds);

  return (
    <Screen>
      <ChipRow>
        {NOTIFICATION_FILTERS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
          />
        ))}
      </ChipRow>
      {unread > 0 ? (
        <CtaButton
          label={`모두 읽음으로 표시 (${unread})`}
          variant="secondary"
          onPress={() => markAllRead(items.map((item) => item.id))}
        />
      ) : null}
      {visible.length === 0 ? (
        <EmptyView icon={BellOff} message="이 분류의 알림이 없어요." />
      ) : null}
      <View>
        {visible.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            isRead={isNotificationRead(item, readIds)}
            onPress={() => markRead(item.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

export default function NotificationsScreen() {
  const state = useNotificationsQuery();
  return (
    <QueryBoundary
      state={state}
      isEmpty={isEmptyList}
      emptyMessage="새로운 알림이 없어요."
      emptyIcon={BellOff}
    >
      {(items) => <NotificationList items={items} />}
    </QueryBoundary>
  );
}
