import {
  useMarkNotificationsRead,
  useNotificationPreferences,
  useNotifications,
  useUnreadNotificationCount,
  useUpdateNotificationPreferences,
} from '@theolive/api';

import { useSession } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/format';
import { toQueryState, type QueryState } from '@/lib/queryState';
import type { AppNotification, NotificationPreferences } from '@/models';
import { supabase } from '@/services/supabase';

// In-app notifications (OTH-03/05). The server writes them and owns the read flag; `useUserOrdersChannel`
// (mounted by useOrderLiveSync) refetches these queries on `notification_created` and on reconnect.

function useUserId(): string | null {
  return useSession().session?.user.id ?? null;
}

export function useNotificationsQuery(): QueryState<AppNotification[]> {
  const state = toQueryState(useNotifications(supabase, useUserId()));
  if (state.status !== 'success') return state;
  return {
    status: 'success',
    data: state.data.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      at: formatDateTime(item.createdAt),
      isRead: item.isRead,
      orderId: item.orderId,
    })),
  };
}

export function useUnreadCount(): number {
  return useUnreadNotificationCount(supabase, useUserId()).data ?? 0;
}

export const useMarkNotificationsReadMutation = () => useMarkNotificationsRead(supabase);

export function useNotificationPreferencesQuery(): QueryState<NotificationPreferences> {
  return toQueryState(useNotificationPreferences(supabase, useUserId()));
}

export const useUpdateNotificationPreferencesMutation = () =>
  useUpdateNotificationPreferences(supabase, useUserId());
