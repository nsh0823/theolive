import { toDateInputValue } from '@/lib/format';
import { MS_PER_DAY } from '@/lib/time';
import { ORDER_STATUS, PAYMENT_STATUS, type Order } from './models';

const COUNTED_STATUSES: readonly string[] = [
  ORDER_STATUS.PAID,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.COMPLETED,
];

/** Display-only: the server owns the real sales numbers (CLAUDE.md "Server owns the truth"). */
export function isSalesOrder(order: Order): boolean {
  return order.paymentStatus === PAYMENT_STATUS.PAID && COUNTED_STATUSES.includes(order.status);
}

export type TodaySummary = { sales: number; orderCount: number; averageAmount: number };

export function summarizeDay(orders: readonly Order[], dayKey: string): TodaySummary {
  const sales = orders.filter(isSalesOrder).filter((o) => toDateInputValue(o.placedAt) === dayKey);
  const total = sales.reduce((sum, order) => sum + order.paidAmount, 0);
  return {
    sales: total,
    orderCount: sales.length,
    averageAmount: sales.length === 0 ? 0 : Math.round(total / sales.length),
  };
}

export type PopularItem = { name: string; quantity: number };

export function rankPopularItems(orders: readonly Order[], limit: number): PopularItem[] {
  const counts = new Map<string, number>();
  for (const order of orders.filter(isSalesOrder)) {
    for (const line of order.lines) {
      counts.set(line.name, (counts.get(line.name) ?? 0) + line.quantity);
    }
  }
  return [...counts.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** "아메리카노 ×2 외 1건" style summary for tables. */
export function summarizeMenu(order: Order): string {
  const [first, ...rest] = order.lines;
  if (!first) return '-';
  const head = `${first.name} ${first.quantity}개`;
  return rest.length === 0 ? head : `${head} 외 ${rest.length}건`;
}

export type DailySalesPoint = { dayKey: string; label: string; value: number; isToday: boolean };

const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Builds the last `prior.length + 1` days ending today. Past days come from `prior` (oldest first). */
export function buildDailySales(
  prior: readonly number[],
  todayValue: number,
  nowMs: number,
): DailySalesPoint[] {
  const values = [...prior, todayValue];
  return values.map((value, index) => {
    const offset = values.length - 1 - index;
    const date = new Date(nowMs - offset * MS_PER_DAY);
    return {
      dayKey: toDateInputValue(date.toISOString()),
      label: `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAY_SHORT[date.getDay()] ?? ''})`,
      value,
      isToday: offset === 0,
    };
  });
}
