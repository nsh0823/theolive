/**
 * Query-shaped stand-ins for future TanStack Query hooks. Each returns the same
 * `QueryState` a real hook would, so screens do not change when these are swapped.
 */
import { successState, type QueryState } from '@/lib/queryState';
import type {
  AppNotification,
  Coupon,
  LedgerEntry,
  MenuCategory,
  MenuItem,
  Notice,
  NotificationPreferences,
  Order,
  PointSummary,
  Profile,
  StampExchangeOption,
  StampSummary,
} from '@/models';
import * as data from './data';

export const useProfileQuery = (): QueryState<Profile> => successState(data.FIXTURE_PROFILE);
export const useCategoriesQuery = (): QueryState<MenuCategory[]> =>
  successState(data.FIXTURE_CATEGORIES);
export const useMenuQuery = (): QueryState<MenuItem[]> => successState(data.FIXTURE_MENU);
export const useRecentMenuQuery = (): QueryState<MenuItem[]> =>
  successState(
    data.FIXTURE_RECENT_MENU_IDS.flatMap((id) =>
      data.FIXTURE_MENU.filter((item) => item.id === id),
    ),
  );
export const useStampsQuery = (): QueryState<StampSummary> => successState(data.FIXTURE_STAMPS);
export const usePointsQuery = (): QueryState<PointSummary> => successState(data.FIXTURE_POINTS);
export const useStampExchangeQuery = (): QueryState<StampExchangeOption[]> =>
  successState(data.FIXTURE_STAMP_EXCHANGE);
export const useCouponsQuery = (): QueryState<Coupon[]> => successState(data.FIXTURE_COUPONS);
export const useStampLedgerQuery = (): QueryState<LedgerEntry[]> =>
  successState(data.FIXTURE_STAMP_LEDGER);
export const usePointLedgerQuery = (): QueryState<LedgerEntry[]> =>
  successState(data.FIXTURE_POINT_LEDGER);
export const useOrdersQuery = (): QueryState<Order[]> => successState(data.FIXTURE_ORDERS);
export const useNotificationsQuery = (): QueryState<AppNotification[]> =>
  successState(data.FIXTURE_NOTIFICATIONS);
export const useNoticesQuery = (): QueryState<Notice[]> => successState(data.FIXTURE_NOTICES);
export const useNotificationPreferencesQuery = (): QueryState<NotificationPreferences> =>
  successState(data.FIXTURE_NOTIFICATION_PREFERENCES);
export const useTermsQuery = () => successState(data.FIXTURE_TERMS);
export const useInquiryChannelQuery = () => successState(data.FIXTURE_INQUIRY_CHANNEL);

export function useOrderQuery(orderId: string): QueryState<Order | null> {
  return successState(data.FIXTURE_ORDERS.find((order) => order.id === orderId) ?? null);
}

export function useMenuItemQuery(itemId: string): QueryState<MenuItem | null> {
  return successState(data.FIXTURE_MENU.find((item) => item.id === itemId) ?? null);
}
