import { useRouter } from 'expo-router';
import { BellOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { NotificationItem } from '@/components/home/NotificationItem';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { CtaButton } from '@/components/ui/CtaButton';
import { EmptyView } from '@/components/ui/StateViews';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@theolive/ui/components/text';
import { useMarkNotificationsReadMutation, useNotificationsQuery } from '@/hooks/useNotifications';
import {
  NOTIFICATION_FILTERS,
  filterNotifications,
  notificationOrderId,
  unreadCount,
  type NotificationFilter,
} from '@/lib/notifications';
import type { AppNotification } from '@/models';

const MARK_FAILED_MESSAGE = '읽음 처리에 실패했어요. 잠시 후 다시 시도해 주세요.';

function NotificationList({ items }: { items: AppNotification[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const mark = useMarkNotificationsReadMutation();
  const visible = filterNotifications(items, filter);
  const unread = unreadCount(items);

  const open = (item: AppNotification) => {
    if (!item.isRead) mark.mutate([item.id]);
    const orderId = notificationOrderId(item);
    if (orderId) router.push({ pathname: '/other/orders/[orderId]', params: { orderId } });
  };

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
          isLoading={mark.isPending}
          onPress={() => mark.mutate(null)}
        />
      ) : null}
      {mark.isError ? (
        <Card className="bg-secondary" accessibilityLiveRegion="polite">
          <Text className="text-secondary-foreground">{MARK_FAILED_MESSAGE}</Text>
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <EmptyView icon={BellOff} message="이 분류의 알림이 없어요." />
      ) : null}
      <View>
        {visible.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            isRead={item.isRead}
            onPress={() => open(item)}
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
