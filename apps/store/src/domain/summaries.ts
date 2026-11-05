import type { SalesDayView } from '@theolive/api';
import type { Order } from './models';

/** "아메리카노 ×2 외 1건" style summary for tables. */
export function summarizeMenu(order: Order): string {
  const [first, ...rest] = order.lines;
  if (!first) return '-';
  const head = `${first.name} ${first.quantity}개`;
  return rest.length === 0 ? head : `${head} 외 ${rest.length}건`;
}

export type DailySalesPoint = { dayKey: string; label: string; value: number; isToday: boolean };

const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Chart bars from the server's per-day sales (oldest first); the last day is today. */
export function toSalesPoints(days: readonly SalesDayView[]): DailySalesPoint[] {
  return days.map((day, index) => {
    // The date is a Seoul business date; parsing it as UTC midnight keeps the weekday the same everywhere.
    const date = new Date(`${day.date}T00:00:00Z`);
    return {
      dayKey: day.date,
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()} (${WEEKDAY_SHORT[date.getUTCDay()] ?? ''})`,
      value: day.sales,
      isToday: index === days.length - 1,
    };
  });
}
