import { NOTIFICATION_KIND, type AppNotification, type NotificationKind } from '@/models';

export type NotificationFilter = 'all' | NotificationKind;

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: NOTIFICATION_KIND.ORDER, label: '주문' },
  { value: NOTIFICATION_KIND.PAYMENT, label: '결제' },
  { value: NOTIFICATION_KIND.STAMP, label: '스탬프' },
  { value: NOTIFICATION_KIND.COUPON, label: '쿠폰' },
  { value: NOTIFICATION_KIND.POINT, label: '포인트' },
  { value: NOTIFICATION_KIND.NOTICE, label: '공지' },
];

/** Server read flag OR a local read mark counts as read. */
export const isNotificationRead = (item: AppNotification, readIds: string[]) =>
  item.isRead || readIds.includes(item.id);

export function unreadCount(items: AppNotification[], readIds: string[]): number {
  return items.filter((item) => !isNotificationRead(item, readIds)).length;
}

export function filterNotifications(
  items: AppNotification[],
  filter: NotificationFilter,
): AppNotification[] {
  return filter === 'all' ? items : items.filter((item) => item.kind === filter);
}
