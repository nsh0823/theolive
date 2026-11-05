import { describe, expect, it, vi } from 'vitest';

import { fetchMember, fetchMembers, toMemberView } from './members';
import { fetchPopularItems, fetchSalesSummary } from './reporting';

const MEMBER = {
  id: '00000000-0000-4000-8000-0000000000d1',
  nickname: '하나',
  maskedEmail: 'zqxh***@example.test',
  maskedPhone: null,
  provider: 'KAKAO',
  joinedAt: '2026-11-01T00:00:00Z',
  orderCount: 2,
  totalSpent: 11500,
  lastOrderAt: '2026-11-05T01:00:00Z',
};

describe('fetchSalesSummary', () => {
  it('maps the server aggregate and passes the business dates through unchanged', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        days: [{ date: '2026-11-04', sales: 9000, orderCount: 2 }],
        total: 9000,
        orderCount: 2,
        averageAmount: 4500,
      },
      error: null,
    });
    const result = await fetchSalesSummary({ rpc } as never, '2026-11-04', '2026-11-05');
    expect(rpc).toHaveBeenCalledWith('admin_sales_summary', {
      p_from: '2026-11-04',
      p_to: '2026-11-05',
    });
    expect(result).toEqual({
      days: [{ date: '2026-11-04', sales: 9000, orderCount: 2 }],
      total: 9000,
      orderCount: 2,
      averageAmount: 4500,
    });
  });

  it('maps a forbidden caller to its app code', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'P0001', message: 'FORBIDDEN' } });
    await expect(fetchSalesSummary({ rpc } as never, 'a', 'b')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('treats a missing number as a server fault', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { days: [], total: 'x', orderCount: 0, averageAmount: 0 },
      error: null,
    });
    await expect(fetchSalesSummary({ rpc } as never, 'a', 'b')).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});

describe('fetchPopularItems', () => {
  it('maps names and quantities and sends the limit', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ name: '카페 라떼', quantity: 4 }], error: null });
    expect(await fetchPopularItems({ rpc } as never, 'a', 'b', 5)).toEqual([
      { name: '카페 라떼', quantity: 4 },
    ]);
    expect(rpc).toHaveBeenCalledWith('admin_popular_items', { p_from: 'a', p_to: 'b', p_limit: 5 });
  });
  it('rejects a non-list answer', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await expect(fetchPopularItems({ rpc } as never, 'a', 'b', 5)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});

describe('members (SA-12)', () => {
  it('maps a member and keeps missing contact data as null', () => {
    expect(toMemberView(MEMBER)).toEqual(MEMBER);
    expect(toMemberView({ ...MEMBER, maskedEmail: undefined }).maskedEmail).toBeNull();
  });

  it('sends a trimmed search, or none, and the paging', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [MEMBER], total: 1 }, error: null });
    expect(
      await fetchMembers({ rpc } as never, { search: '  하나 ', limit: 50, offset: 0 }),
    ).toEqual({ members: [MEMBER], total: 1 });
    expect(rpc).toHaveBeenLastCalledWith('admin_list_members', {
      p_search: '하나',
      p_limit: 50,
      p_offset: 0,
    });
    await fetchMembers({ rpc } as never, { search: '   ', limit: 50, offset: 50 });
    expect(rpc).toHaveBeenLastCalledWith('admin_list_members', {
      p_search: undefined,
      p_limit: 50,
      p_offset: 50,
    });
  });

  it('keeps the stamp ledger and the point ledger as two lists', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ...MEMBER,
        stampBalance: 3,
        pointBalance: 4000,
        stampLedger: [
          { id: 1, kind: 'EARN', label: '주문 적립', delta: 1, balanceAfter: 3, createdAt: 't' },
        ],
        pointLedger: [
          {
            id: 9,
            kind: 'REGISTER',
            label: '코드 등록',
            delta: 4000,
            balanceAfter: 4000,
            createdAt: 't',
          },
        ],
        orders: [
          {
            id: 'o',
            orderNumber: 'A-1',
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            paidAmount: 4500,
            placedAt: 't',
          },
        ],
      },
      error: null,
    });
    const member = await fetchMember({ rpc } as never, MEMBER.id);
    expect(member.stampLedger.map((entry) => entry.kind)).toEqual(['EARN']);
    expect(member.pointLedger.map((entry) => entry.kind)).toEqual(['REGISTER']);
    expect(member.stampBalance).toBe(3);
    expect(member.pointBalance).toBe(4000);
    expect(member.orders[0]?.orderNumber).toBe('A-1');
  });

  it('maps NOT_FOUND', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'P0001', message: 'NOT_FOUND' } });
    await expect(fetchMember({ rpc } as never, 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
