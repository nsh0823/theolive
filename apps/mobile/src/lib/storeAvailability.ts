import type { StoreStatusView } from '@theolive/api';

export type Availability = { canOrder: boolean; message: string | null };

export const STORE_CLOSED_MESSAGE =
  '지금은 매장이 영업 중이 아니에요. 메뉴는 볼 수 있지만 주문할 수 없어요.';
export const NOT_ACCEPTING_MESSAGE = '지금은 주문을 받지 않아요. 잠시 후 다시 시도해 주세요.';

/**
 * Banner and button state from the store switches. While the status is unknown (loading, offline) ordering is
 * not blocked here: the server re-checks every checkout, so this only improves the experience.
 */
export function availabilityOf(status: StoreStatusView | null): Availability {
  if (status === null) return { canOrder: true, message: null };
  if (!status.isOpen) return { canOrder: false, message: STORE_CLOSED_MESSAGE };
  if (!status.isAcceptingOrders) return { canOrder: false, message: NOT_ACCEPTING_MESSAGE };
  return { canOrder: true, message: null };
}
