import { describe, expect, it } from 'vitest';
import { createOrders } from '@/data/fixtures/orders';
import { toDateInputValue } from '@/lib/format';
import { buildDailySales, rankPopularItems, summarizeDay, summarizeMenu } from './summaries';

const NOW = new Date('2026-11-05T14:00:00').getTime();
const orders = createOrders(NOW);

describe('summaries', () => {
  it('counts only paid, non-rejected orders for the given day', () => {
    const today = summarizeDay(orders, toDateInputValue(new Date(NOW).toISOString()));
    expect(today.orderCount).toBe(13);
    expect(today.sales).toBe(119400);
    expect(today.averageAmount).toBe(Math.round(119400 / 13));
  });

  it('returns zeros for a day without orders', () => {
    expect(summarizeDay(orders, '2020-01-01')).toEqual({
      sales: 0,
      orderCount: 0,
      averageAmount: 0,
    });
  });

  it('ranks menu by quantity, ties by name', () => {
    const ranking = rankPopularItems(orders, 3);
    expect(ranking).toHaveLength(3);
    expect(ranking[0]?.name).toBe('아메리카노');
    expect((ranking[0]?.quantity ?? 0) >= (ranking[1]?.quantity ?? 0)).toBe(true);
  });

  it('summarizes menu lines and builds a 7-day series ending today', () => {
    const first = orders[0];
    if (!first) throw new Error('fixture missing');
    expect(summarizeMenu(first)).toBe('아메리카노 2개 외 1건');
    const points = buildDailySales([1, 2, 3, 4, 5, 6], 7, NOW);
    expect(points).toHaveLength(7);
    expect(points.at(-1)).toMatchObject({ value: 7, isToday: true });
    expect(points.filter((p) => p.isToday)).toHaveLength(1);
  });
});
