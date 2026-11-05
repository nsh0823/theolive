import { useQuery } from '@tanstack/react-query';
import { toAppErrorCode } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Store Admin sales (SA-01/02). The server counts paid orders minus refunds per Asia/Seoul business day and leaves
// out unpaid, cancelled and rejected orders; the browser only displays what comes back.

type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

/** `YYYY-MM-DD`, a business day in Asia/Seoul. */
export type BusinessDate = string;

export type SalesDayView = { date: BusinessDate; sales: number; orderCount: number };

export type SalesSummaryView = {
  /** One entry per day of the range, empty days included, oldest first. */
  days: SalesDayView[];
  total: number;
  orderCount: number;
  /** Rounded won per counted order, 0 without orders. */
  averageAmount: number;
};

export type PopularItemView = { name: string; quantity: number };

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

function toDay(value: unknown): SalesDayView {
  const row = asRecord(value);
  return {
    date: String(row.date),
    sales: toNumber(row.sales),
    orderCount: toNumber(row.orderCount),
  };
}

export async function fetchSalesSummary(
  client: Rpc,
  from: BusinessDate,
  to: BusinessDate,
): Promise<SalesSummaryView> {
  const { data, error } = await client.rpc('admin_sales_summary', { p_from: from, p_to: to });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  const days: unknown = body.days;
  return {
    days: Array.isArray(days) ? days.map(toDay) : [],
    total: toNumber(body.total),
    orderCount: toNumber(body.orderCount),
    averageAmount: toNumber(body.averageAmount),
  };
}

export async function fetchPopularItems(
  client: Rpc,
  from: BusinessDate,
  to: BusinessDate,
  limit: number,
): Promise<PopularItemView[]> {
  const { data, error } = await client.rpc('admin_popular_items', {
    p_from: from,
    p_to: to,
    p_limit: limit,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  if (!Array.isArray(data)) throw new AppError('INTERNAL');
  return data.map((value) => {
    const row = asRecord(value);
    return { name: String(row.name), quantity: toNumber(row.quantity) };
  });
}

export function useSalesSummary(client: TypedSupabaseClient, from: BusinessDate, to: BusinessDate) {
  return useQuery({
    queryKey: queryKeys.reporting.sales(from, to),
    queryFn: () => fetchSalesSummary(client, from, to),
  });
}

export function usePopularItems(
  client: TypedSupabaseClient,
  from: BusinessDate,
  to: BusinessDate,
  limit: number,
) {
  return useQuery({
    queryKey: queryKeys.reporting.popular(from, to, limit),
    queryFn: () => fetchPopularItems(client, from, to, limit),
  });
}
