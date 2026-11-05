import {
  useCancelOrder,
  useCreateCheckout,
  useConfirmPayment,
  useMyOrder,
  useMyOrders,
  usePaymentStatus,
  useRunTestPayment,
} from '@theolive/api';

import { toQueryState, type QueryState } from '@/lib/queryState';
import type { Order } from '@/models';
import { supabase } from '@/services/supabase';

/** Paid orders of the signed-in customer, newest first (row-level security scopes them). */
export function useOrdersQuery(): QueryState<Order[]> {
  return toQueryState(useMyOrders(supabase));
}

export function useOrderQuery(orderId: string): QueryState<Order | null> {
  return toQueryState(useMyOrder(supabase, orderId));
}

export const useCheckoutMutation = () => useCreateCheckout(supabase);
export const useTestPaymentMutation = () => useRunTestPayment(supabase);
export const useConfirmPaymentMutation = () => useConfirmPayment(supabase);
export const useCancelOrderMutation = () => useCancelOrder(supabase);

/** Asks the server about the payment (recovery after a killed app); enabled only while the order is unpaid. */
export function useRecoverPayment(orderId: string, enabled: boolean): void {
  usePaymentStatus(supabase, orderId, enabled);
}
