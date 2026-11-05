import { useAdminOrders, useBoardOrders, type AdminOrderFilters } from '@theolive/api';
import { useMemo } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { toStoreOrder } from '@/domain/orderMapper';
import type { Order } from '@/domain/models';
import { toBoundaryStatus, type QueryResult } from './queryStatus';

// Orders from the server in the `{ status, data, refetch }` shape the screens already use.

function toResult(query: {
  status: 'pending' | 'error' | 'success';
  data: Order[];
  refetch: () => unknown;
}): QueryResult<Order[]> {
  return {
    status: toBoundaryStatus(query.status),
    data: query.data,
    refetch: () => void query.refetch(),
  };
}

/** Paid orders waiting for or in preparation (the four board columns). */
export function useBoardOrdersQuery(): QueryResult<Order[]> {
  const query = useBoardOrders(useSupabase());
  const data = useMemo(() => (query.data ?? []).map(toStoreOrder), [query.data]);
  return toResult({ status: query.status, data, refetch: query.refetch });
}

/** Store Admin order history. The server narrows by date and status; the rest is filtered on screen. */
export function useAdminOrdersQuery(filters: AdminOrderFilters): QueryResult<Order[]> {
  const query = useAdminOrders(useSupabase(), filters);
  const data = useMemo(() => (query.data ?? []).map(toStoreOrder), [query.data]);
  return toResult({ status: query.status, data, refetch: query.refetch });
}
