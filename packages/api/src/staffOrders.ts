import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_STATUS,
  toAppErrorCode,
  type OrderRejectReason,
  type OrderStatus,
  type StaffOrderAction,
} from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { ORDER_SELECT, toOrderView, type OrderView } from './orders';
import { requestRefundExecution } from './payments';
import { queryKeys } from './query-keys';
import { asRecord, toOrderStatus } from './statusGuards';

/** Board columns: paid orders waiting for staff and the three in-progress states (SW-01..SW-04). */
export const BOARD_ORDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PAID,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
];

/** The board refetches this often while the tab is visible, in case a realtime event is missed (plan section 6). */
export const BOARD_REFETCH_MS = 30_000;

export async function fetchBoardOrders(
  client: Pick<TypedSupabaseClient, 'from'>,
): Promise<OrderView[]> {
  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .in('status', BOARD_ORDER_STATUSES)
    .order('paid_at', { ascending: true });
  if (error) throw error;
  return data.map(toOrderView);
}

/** Row-level security limits this to paid orders for staff with PROCESS_ORDERS (and admins). */
export async function fetchStaffOrder(
  client: Pick<TypedSupabaseClient, 'from'>,
  id: string,
): Promise<OrderView | null> {
  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toOrderView(data) : null;
}

export function useBoardOrders(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.orders.board(),
    queryFn: () => fetchBoardOrders(client),
    refetchInterval: BOARD_REFETCH_MS,
  });
}

export function useStaffOrder(client: TypedSupabaseClient, id: string | null) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: () => (id ? fetchStaffOrder(client, id) : null),
    enabled: id !== null,
  });
}

export type TransitionInput = {
  orderId: string;
  action: StaffOrderAction;
  /** The status the tablet is showing; a different server status answers STALE_STATUS. */
  expectedStatus: OrderStatus;
  reasonCode?: OrderRejectReason;
  reason?: string;
};

export type TransitionResult = {
  status: OrderStatus;
  isReplay: boolean;
};

export async function transitionOrder(
  client: Pick<TypedSupabaseClient, 'rpc' | 'functions'>,
  input: TransitionInput,
): Promise<TransitionResult> {
  const { data, error } = await client.rpc('staff_transition_order', {
    p_order_id: input.orderId,
    p_action: input.action,
    p_expected_status: input.expectedStatus,
    p_reason_code: input.reasonCode,
    p_reason: input.reason,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const result = asRecord(data);
  const isReplay = result.isReplay === true;
  if (input.action === 'REJECT' && !isReplay) {
    // The refund is recorded in the same transaction; this sends it to the provider right away.
    await sendRefundBestEffort(client, input.orderId);
  }
  return { status: toOrderStatus(result.status), isReplay };
}

/** The reconcile job retries a refund whose immediate attempt failed, so the order action itself still succeeded. */
async function sendRefundBestEffort(
  client: Pick<TypedSupabaseClient, 'functions'>,
  orderId: string,
): Promise<void> {
  try {
    await requestRefundExecution(client, orderId);
  } catch (error) {
    console.error('Refund will be retried by the reconcile job', error);
  }
}

export function useTransitionOrder(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionInput) => transitionOrder(client, input),
    // Success or STALE_STATUS: either way the board must show the server's current state.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

/** OQ-9: admin-only cancel of a PAID or ACCEPTED order with a reason; refunded automatically. */
export async function adminCancelOrder(
  client: Pick<TypedSupabaseClient, 'rpc' | 'functions'>,
  input: { orderId: string; expectedStatus: OrderStatus; reason: string },
): Promise<void> {
  const { error } = await client.rpc('staff_cancel_order', {
    p_order_id: input.orderId,
    p_expected_status: input.expectedStatus,
    p_reason: input.reason,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  await sendRefundBestEffort(client, input.orderId);
}

export function useAdminCancelOrder(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; expectedStatus: OrderStatus; reason: string }) =>
      adminCancelOrder(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export type AdminOrderFilters = {
  /** KST business dates, inclusive (`YYYY-MM-DD`). */
  fromDate?: string;
  toDate?: string;
  status?: OrderStatus;
  orderNumber?: string;
};

export const ADMIN_ORDER_LIMIT = 200;

/** SA-06: paid orders for the history page; filtering happens in the database. */
export async function fetchAdminOrders(
  client: Pick<TypedSupabaseClient, 'from'>,
  filters: AdminOrderFilters,
): Promise<OrderView[]> {
  let query = client
    .from('orders')
    .select(ORDER_SELECT)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(ADMIN_ORDER_LIMIT);
  if (filters.fromDate) query = query.gte('business_date', filters.fromDate);
  if (filters.toDate) query = query.lte('business_date', filters.toDate);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.orderNumber) query = query.ilike('order_number', `%${filters.orderNumber.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toOrderView);
}

export function useAdminOrders(client: TypedSupabaseClient, filters: AdminOrderFilters) {
  return useQuery({
    queryKey: queryKeys.orders.admin(filters),
    queryFn: () => fetchAdminOrders(client, filters),
  });
}
