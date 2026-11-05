import { describe, expect, it } from 'vitest';
import { createMembers, createPointLedgers, createStampLedgers } from '@/data/fixtures/members';
import { createOrders } from '@/data/fixtures/orders';
import { LOGIN_PROVIDER } from './memberModels';
import {
  EMPTY_MEMBER_FILTERS,
  computeMemberStats,
  filterMembers,
  hasActiveMemberFilters,
  ordersOfMember,
  pointBalance,
  stampBalance,
} from './members';

const NOW = new Date('2026-11-05T14:00:00').getTime();
const members = createMembers(NOW);
const orders = createOrders(NOW);

describe('filterMembers', () => {
  it('returns all members, newest join first', () => {
    const all = filterMembers(members, orders, EMPTY_MEMBER_FILTERS);
    expect(all).toHaveLength(25);
    expect(all[0]?.id).toBe('m25');
    expect(hasActiveMemberFilters(EMPTY_MEMBER_FILTERS)).toBe(false);
  });

  it('searches nickname and order number, case-insensitively', () => {
    expect(
      filterMembers(members, orders, { ...EMPTY_MEMBER_FILTERS, query: '라떼' }).map((m) => m.id),
    ).toEqual(['m03']);
    expect(
      filterMembers(members, orders, { ...EMPTY_MEMBER_FILTERS, query: ' a-41 ' }).map((m) => m.id),
    ).toEqual(['m01']);
    expect(filterMembers(members, orders, { ...EMPTY_MEMBER_FILTERS, query: 'zzz' })).toEqual([]);
  });

  it('does not search by contact data', () => {
    expect(filterMembers(members, orders, { ...EMPTY_MEMBER_FILTERS, query: 'gmail' })).toEqual([]);
    expect(filterMembers(members, orders, { ...EMPTY_MEMBER_FILTERS, query: '010' })).toEqual([]);
  });

  it('filters by provider and inclusive join-date range', () => {
    const apple = filterMembers(members, orders, {
      ...EMPTY_MEMBER_FILTERS,
      provider: LOGIN_PROVIDER.APPLE,
    });
    expect(apple.map((m) => m.id).sort()).toEqual(['m07', 'm17', 'm22']);
    const recent = filterMembers(members, orders, {
      ...EMPTY_MEMBER_FILTERS,
      joinedFrom: '2026-10-31',
    });
    expect(recent.map((m) => m.id)).toEqual(['m25', 'm24', 'm23', 'm22', 'm21']);
    const none = filterMembers(members, orders, {
      ...EMPTY_MEMBER_FILTERS,
      joinedFrom: '2026-11-04',
      joinedTo: '2026-11-03',
    });
    expect(none).toEqual([]);
  });
});

describe('member stats and ledgers', () => {
  it('derives counts, spend and last order from the order fixtures', () => {
    const stats = computeMemberStats(ordersOfMember(orders, 'm01'));
    expect(stats.orderCount).toBe(3);
    expect(stats.totalSpent).toBe(31300);
    expect(computeMemberStats([])).toEqual({ orderCount: 0, totalSpent: 0, lastOrderAt: null });
  });

  it('keeps stamp and point balances independent and non-negative', () => {
    const stamps = createStampLedgers(members, orders);
    const points = createPointLedgers(members, orders);
    for (const member of members) {
      expect(stampBalance(stamps[member.id] ?? [])).toBeGreaterThanOrEqual(0);
      expect(pointBalance(points[member.id] ?? [])).toBeGreaterThanOrEqual(0);
    }
    expect(pointBalance(points.m03 ?? [])).toBe(20000 - 3000 - 3000 - 5000);
    expect(stampBalance(stamps.m03 ?? [])).toBe(22 + 3 - 10);
  });
});
