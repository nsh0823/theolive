import { describe, expect, it } from 'vitest';
import { createOrders } from '@/test/orderFactory';
import { summarizeMenu, toSalesPoints } from './summaries';

describe('toSalesPoints', () => {
  it('labels the server days, keeps the values, and marks only the last as today', () => {
    const points = toSalesPoints([
      { date: '2026-11-04', sales: 9000, orderCount: 2 },
      { date: '2026-11-05', sales: 0, orderCount: 0 },
    ]);
    expect(points).toEqual([
      { dayKey: '2026-11-04', label: '11/4 (수)', value: 9000, isToday: false },
      { dayKey: '2026-11-05', label: '11/5 (목)', value: 0, isToday: true },
    ]);
  });
});

describe('summarizeMenu', () => {
  it('names the first line and counts the rest', () => {
    const order = createOrders().find((o) => o.lines.length > 1);
    expect(order).toBeDefined();
    if (!order) return;
    expect(summarizeMenu(order)).toMatch(/ 외 \d+건$/);
    expect(summarizeMenu({ ...order, lines: [] })).toBe('-');
  });
});
