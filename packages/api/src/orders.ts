import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_STATUS,
  toAppErrorCode,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type Temperature,
} from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { requestRefundExecution } from './payments';
import { queryKeys } from './query-keys';

export type OrderLineView = {
  menuItemId: string | null;
  name: string;
  /** `null` for items sold without a temperature choice. */
  temperature: Temperature | null;
  quantity: number;
  unitPrice: number;
};

/** An order as both apps render it. Totals are the server's snapshot, never recomputed on the device. */
export type OrderView = {
  id: string;
  /** `null` until the order is paid (OQ-13). */
  orderNumber: string | null;
  /** `paid_at` once paid, otherwise the time the checkout started. */
  placedAt: string;
  paidAt: string | null;
  expiresAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  orderType: OrderType;
  lines: OrderLineView[];
  note: string | null;
  menuAmount: number;
  couponDiscount: number;
  /** Title of the coupon applied to this order (snapshot), or null. */
  couponTitle: string | null;
  pointsUsed: number;
  paidAmount: number;
  memberId: string | null;
  rejectReasonCode: string | null;
  rejectReason: string | null;
  cancelReason: string | null;
  /** When the order was rejected or cancelled; `null` while it is still live or completed. */
  endedAt: string | null;
};

export type OrderRowWithItems = OrderRow & { order_items: OrderItemRow[] };

export const ORDER_SELECT = '*, order_items(*)';

export function toOrderView(row: OrderRowWithItems): OrderView {
  return {
    id: row.id,
    orderNumber: row.order_number,
    placedAt: row.paid_at ?? row.created_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    orderType: row.order_type,
    lines: [...row.order_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        menuItemId: item.menu_item_id,
        name: item.name_snapshot,
        temperature: item.temperature,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
    note: row.note,
    menuAmount: row.menu_amount,
    couponDiscount: row.coupon_discount,
    couponTitle: row.coupon_title_snapshot,
    pointsUsed: row.points_used,
    paidAmount: row.paid_amount,
    memberId: row.customer_id,
    rejectReasonCode: row.reject_reason_code,
    rejectReason: row.reject_reason,
    cancelReason: row.cancel_reason,
    endedAt: row.rejected_at ?? row.cancelled_at,
  };
}

/** Statuses after which nothing changes any more (the screens stop polling). */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELLED,
];

export function isTerminalOrder(order: Pick<OrderView, 'status' | 'paymentStatus'>): boolean {
  // A cancelled / rejected order is still changing while its refund is in flight.
  if (order.status === ORDER_STATUS.COMPLETED) return true;
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) return order.paymentStatus !== 'PAID';
  return false;
}

/** Customers see their own orders only (row-level security); unpaid and failed checkouts are not history. */
export async function fetchMyOrders(
  client: Pick<TypedSupabaseClient, 'from'>,
): Promise<OrderView[]> {
  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return data.map(toOrderView);
}

export async function fetchOrder(
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

export function useMyOrders(client: TypedSupabaseClient, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.mine(),
    queryFn: () => fetchMyOrders(client),
    enabled,
  });
}

/** Backstop while the order is not final: realtime is a hint and can miss events (P5), so refetch every 15 s. */
export const ACTIVE_ORDER_REFETCH_MS = 15_000;

export function useMyOrder(client: TypedSupabaseClient, id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => fetchOrder(client, id),
    enabled: enabled && id !== '',
    refetchInterval: (query) => {
      const order = query.state.data;
      return order && !isTerminalOrder(order) ? ACTIVE_ORDER_REFETCH_MS : false;
    },
  });
}

export type CancelOrderInput = { orderId: string; expectedStatus: OrderStatus };

/** OQ-8: cancel while unpaid or PAID (before staff accept). A paid order is refunded automatically. */
export async function cancelMyOrder(
  client: TypedSupabaseClient,
  input: CancelOrderInput,
): Promise<void> {
  const { error } = await client.rpc('customer_cancel_order', {
    p_order_id: input.orderId,
    p_expected_status: input.expectedStatus,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  // The refund is already recorded by the database; this call only sends it to the provider right away.
  // If it fails, the reconcile job retries, so the cancel itself still counts.
  try {
    await requestRefundExecution(client, input.orderId);
  } catch (refundError) {
    if (!(refundError instanceof AppError) || refundError.code !== 'NOT_REFUNDABLE') {
      console.error('Refund will be retried by the reconcile job', refundError);
    }
  }
}

export function useCancelOrder(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelOrderInput) => cancelMyOrder(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}
