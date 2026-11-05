import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toAppErrorCode, type NotificationKind, type NotificationRow } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// In-app notifications (OTH-03/05). The server writes them (triggers, one per source event) and sends a
// `notification_created` hint on `user:<uid>`; the app only reads, marks read and edits its two preferences.
// Push notifications are out of the MVP (OQ-37).

type Db = Pick<TypedSupabaseClient, 'from'>;
type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

/** Newest notifications shown in the list (the server keeps them for a year, OQ-35). */
export const NOTIFICATION_LIST_LIMIT = 100;

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
};

export function toNotificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    orderId: row.order_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(client: Db, userId: string): Promise<NotificationView[]> {
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_LIST_LIMIT);
  if (error) throw error;
  return data.map(toNotificationView);
}

export async function fetchUnreadNotificationCount(client: Db, userId: string): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

/** Marks the given notifications (or all of the caller's, when `ids` is `null`) as read. Returns how many changed. */
export async function markNotificationsRead(client: Rpc, ids: string[] | null): Promise<number> {
  const { data, error } = await client.rpc('mark_notifications_read', {
    p_ids: ids ?? undefined,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const updated = Number(asRecord(data).updated);
  if (!Number.isFinite(updated)) throw new AppError('INTERNAL');
  return updated;
}

export function useNotifications(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications.list(userId ?? ''),
    queryFn: () => fetchNotifications(client, userId ?? ''),
    enabled: userId !== null,
  });
}

export function useUnreadNotificationCount(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(userId ?? ''),
    queryFn: () => fetchUnreadNotificationCount(client, userId ?? ''),
    enabled: userId !== null,
  });
}

export function useMarkNotificationsRead(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | null) => markNotificationsRead(client, ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

// ---- Preferences ----

/** `orderUpdates` covers order, payment, stamp, coupon and point messages; `notices` covers 공지. */
export type NotificationPreferencesView = { orderUpdates: boolean; notices: boolean };

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesView = {
  orderUpdates: true,
  notices: true,
};

/** No row yet means every kind is on (the server applies the same default). */
export async function fetchNotificationPreferences(
  client: Db,
  userId: string,
): Promise<NotificationPreferencesView> {
  const { data, error } = await client
    .from('notification_preferences')
    .select('order_updates, notices')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { orderUpdates: data.order_updates, notices: data.notices }
    : DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function saveNotificationPreferences(
  client: Db,
  userId: string,
  preferences: NotificationPreferencesView,
): Promise<void> {
  const values = { order_updates: preferences.orderUpdates, notices: preferences.notices };
  const { data, error } = await client
    .from('notification_preferences')
    .update(values)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw new AppError(toAppErrorCode(error));
  if (data.length > 0) return;
  const { error: insertError } = await client
    .from('notification_preferences')
    .insert({ user_id: userId, ...values });
  if (insertError) throw new AppError(toAppErrorCode(insertError));
}

export function useNotificationPreferences(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(userId ?? ''),
    queryFn: () => fetchNotificationPreferences(client, userId ?? ''),
    enabled: userId !== null,
  });
}

export function useUpdateNotificationPreferences(
  client: TypedSupabaseClient,
  userId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferencesView) => {
      if (userId === null) throw new AppError('UNAUTHENTICATED');
      return saveNotificationPreferences(client, userId, preferences);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
