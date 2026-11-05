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

/** The server owns the read flag. */
export function unreadCount(items: AppNotification[]): number {
  return items.filter((item) => !item.isRead).length;
}

export function filterNotifications(
  items: AppNotification[],
  filter: NotificationFilter,
): AppNotification[] {
  return filter === 'all' ? items : items.filter((item) => item.kind === filter);
}

/** Order and payment messages open the order they are about. */
export function notificationOrderId(item: AppNotification): string | null {
  const isOrderMessage =
    item.kind === NOTIFICATION_KIND.ORDER || item.kind === NOTIFICATION_KIND.PAYMENT;
  return isOrderMessage ? item.orderId : null;
}
