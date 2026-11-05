import { useQuery } from '@tanstack/react-query';
import type { BusinessHoursRow, StoreSettingsRow } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { queryKeys } from './query-keys';

export type StoreStatusView = { isOpen: boolean; isAcceptingOrders: boolean };

export type StoreInfoView = { name: string; phone: string; address: string; description: string };

export type NotificationSettingsView = {
  newOrderSound: boolean;
  newOrderBanner: boolean;
  soldOutReminder: boolean;
  dailySummary: boolean;
};

export type StoreSettingsView = {
  info: StoreInfoView;
  status: StoreStatusView;
  notifications: NotificationSettingsView;
  pendingPaymentTtlMinutes: number;
};

/** 0 = Monday ... 6 = Sunday. Times are "HH:MM". */
export type BusinessHoursView = {
  weekday: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

const HOURS_MINUTES_LENGTH = 5;

/** Postgres `time` arrives as "HH:MM:SS"; the UI works with "HH:MM". */
export function toHourMinute(time: string): string {
  return time.slice(0, HOURS_MINUTES_LENGTH);
}

export function toStoreSettingsView(row: StoreSettingsRow): StoreSettingsView {
  return {
    info: {
      name: row.name,
      phone: row.phone,
      address: row.address,
      description: row.description,
    },
    status: { isOpen: row.is_open, isAcceptingOrders: row.is_accepting_orders },
    notifications: {
      newOrderSound: row.new_order_sound,
      newOrderBanner: row.new_order_banner,
      soldOutReminder: row.sold_out_reminder,
      dailySummary: row.daily_summary,
    },
    pendingPaymentTtlMinutes: row.pending_payment_ttl_minutes,
  };
}

export function toBusinessHoursView(row: BusinessHoursRow): BusinessHoursView {
  return {
    weekday: row.weekday,
    isClosed: row.is_closed,
    opensAt: toHourMinute(row.opens_at),
    closesAt: toHourMinute(row.closes_at),
  };
}

export async function fetchStoreSettings(
  client: Pick<TypedSupabaseClient, 'from'>,
): Promise<StoreSettingsView> {
  const { data, error } = await client.from('store_settings').select('*').single();
  if (error) throw error;
  return toStoreSettingsView(data);
}

export async function fetchBusinessHours(
  client: Pick<TypedSupabaseClient, 'from'>,
): Promise<BusinessHoursView[]> {
  const { data, error } = await client.from('business_hours').select('*').order('weekday');
  if (error) throw error;
  return data.map(toBusinessHoursView);
}

const STORE_STALE_TIME_MS = 30_000;

export function useStoreSettings(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.store.settings(),
    queryFn: () => fetchStoreSettings(client),
    staleTime: STORE_STALE_TIME_MS,
  });
}

/** Open / accepting switches only (SW-08, SA-05). */
export function useStoreStatus(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.store.settings(),
    queryFn: () => fetchStoreSettings(client),
    select: (settings) => settings.status,
    staleTime: STORE_STALE_TIME_MS,
  });
}

export function useBusinessHours(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.store.hours(),
    queryFn: () => fetchBusinessHours(client),
    staleTime: STORE_STALE_TIME_MS,
  });
}
