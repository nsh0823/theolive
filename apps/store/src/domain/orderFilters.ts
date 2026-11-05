import { toDateInputValue } from '@/lib/format';
import type { Order, OrderStatus, OrderType, PaymentStatus } from './models';

export const FILTER_ALL = 'ALL';

export type OrderFilters = {
  query: string;
  /** `YYYY-MM-DD`, inclusive. Empty string means no bound. */
  dateFrom: string;
  dateTo: string;
  status: OrderStatus | typeof FILTER_ALL;
  paymentStatus: PaymentStatus | typeof FILTER_ALL;
  orderType: OrderType | typeof FILTER_ALL;
};

export const EMPTY_ORDER_FILTERS: OrderFilters = {
  query: '',
  dateFrom: '',
  dateTo: '',
  status: FILTER_ALL,
  paymentStatus: FILTER_ALL,
  orderType: FILTER_ALL,
};

export function hasActiveFilters(filters: OrderFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.status !== FILTER_ALL ||
    filters.paymentStatus !== FILTER_ALL ||
    filters.orderType !== FILTER_ALL
  );
}

function matchesQuery(order: Order, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  if (order.orderNumber.toLowerCase().includes(needle)) return true;
  return order.lines.some((line) => line.name.toLowerCase().includes(needle));
}

function matchesDateRange(order: Order, from: string, to: string): boolean {
  // ISO date strings compare correctly as plain strings.
  const day = toDateInputValue(order.placedAt);
  if (from !== '' && day < from) return false;
  if (to !== '' && day > to) return false;
  return true;
}

/** Newest first. Pure: the same inputs always give the same list. */
export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[] {
  return orders
    .filter((order) => matchesQuery(order, filters.query))
    .filter((order) => matchesDateRange(order, filters.dateFrom, filters.dateTo))
    .filter((order) => filters.status === FILTER_ALL || order.status === filters.status)
    .filter(
      (order) =>
        filters.paymentStatus === FILTER_ALL || order.paymentStatus === filters.paymentStatus,
    )
    .filter((order) => filters.orderType === FILTER_ALL || order.orderType === filters.orderType)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}
