import { describe, expect, it, vi } from 'vitest';
import type { CouponPointPolicyRow, CouponPointTransactionRow } from '@theolive/types';

import { fetchCheckoutQuote } from './rewards';
import { fetchPointSummary, registerPointCode, toPointLedgerEntry } from './points';
import {
  fetchPointCodes,
  issuePointCodes,
  savePointPolicy,
  toPointPolicyView,
  voidPointCode,
} from './pointsAdmin';

const UUID = '00000000-0000-4000-8000-0000000000a1';

const ledgerRow: CouponPointTransactionRow = {
  id: 7,
  user_id: UUID,
  kind: 'USE',
  delta: -3000,
  balance_after: 9000,
  code_id: UUID,
  lot_expires_at: '2027-02-04T15:00:00Z',
  order_id: UUID,
  idempotency_key: 'use:x',
  label: '주문 결제',
  actor_id: null,
  created_at: '2026-11-05T10:00:00Z',
};

describe('toPointLedgerEntry', () => {
  it('maps a row and drops the internals', () => {
    expect(toPointLedgerEntry(ledgerRow)).toEqual({
      id: 7,
      kind: 'USE',
      delta: -3000,
      label: '주문 결제',
      createdAt: '2026-11-05T10:00:00Z',
      lotExpiresAt: '2027-02-04T15:00:00Z',
      orderId: UUID,
    });
  });
});

describe('fetchPointSummary', () => {
  it('reads the server numbers', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { balance: 12000, held: 3000, available: 9000, nextExpiresAt: '2027-01-01T00:00:00Z' },
      error: null,
    });
    expect(await fetchPointSummary({ rpc } as never)).toEqual({
      balance: 12000,
      held: 3000,
      available: 9000,
      nextExpiresAt: '2027-01-01T00:00:00Z',
    });
  });
  it('treats a missing expiry as none and a garbage number as a server fault', async () => {
    const ok = vi.fn().mockResolvedValue({
      data: { balance: 0, held: 0, available: 0, nextExpiresAt: null },
      error: null,
    });
    expect((await fetchPointSummary({ rpc: ok } as never)).nextExpiresAt).toBeNull();
    const bad = vi.fn().mockResolvedValue({
      data: { balance: 'x', held: 0, available: 0, nextExpiresAt: null },
      error: null,
    });
    await expect(fetchPointSummary({ rpc: bad } as never)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});

describe('registerPointCode', () => {
  it('sends the trimmed upper-case code and returns the credited points', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'REGISTERED',
        amount: 5000,
        balance: 17000,
        expiresAt: '2027-01-01T00:00:00Z',
      },
      error: null,
    });
    const result = await registerPointCode({ rpc } as never, ' olive-ab23-cd45 ');
    expect(rpc).toHaveBeenCalledWith('register_coupon_point_code', { p_code: 'OLIVE-AB23-CD45' });
    expect(result).toEqual({ amount: 5000, balance: 17000, expiresAt: '2027-01-01T00:00:00Z' });
  });
  it.each(['CODE_INVALID', 'CODE_ALREADY_REGISTERED', 'CODE_EXPIRED', 'CODE_VOID'])(
    'turns a returned rejection %s into an error',
    async (errorCode) => {
      const rpc = vi
        .fn()
        .mockResolvedValue({ data: { status: 'REJECTED', errorCode }, error: null });
      await expect(registerPointCode({ rpc } as never, 'OLIVE-AAAA-BBBB')).rejects.toMatchObject({
        code: errorCode,
        retryAfterSeconds: null,
      });
    },
  );
  it('carries the wait time of the rate limit', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'REJECTED', errorCode: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 420 },
      error: null,
    });
    await expect(registerPointCode({ rpc } as never, 'OLIVE-AAAA-BBBB')).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
      retryAfterSeconds: 420,
    });
  });
  it('does not call the server for a blank code', async () => {
    const rpc = vi.fn();
    await expect(registerPointCode({ rpc } as never, '   ')).rejects.toMatchObject({
      code: 'CODE_INVALID',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reads an unknown rejection as a server fault', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { status: 'REJECTED', errorCode: 'WHAT' }, error: null });
    await expect(registerPointCode({ rpc } as never, 'OLIVE-AAAA-BBBB')).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});

describe('fetchCheckoutQuote with points', () => {
  it('sends the requested points and returns what the server applied', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        menuAmount: 4500,
        couponDiscount: 0,
        pointsUsed: 3000,
        paidAmount: 1500,
        usableCouponIds: [],
        pointsAvailable: 12000,
        maxPointsUsable: 4500,
      },
      error: null,
    });
    const quote = await fetchCheckoutQuote({ rpc } as never, [], null, 99999);
    expect(rpc).toHaveBeenCalledWith('quote_checkout', {
      p_lines: [],
      p_user_coupon_id: undefined,
      p_points_to_use: 99999,
    });
    expect(quote).toMatchObject({
      pointsUsed: 3000,
      paidAmount: 1500,
      pointsAvailable: 12000,
      maxPointsUsable: 4500,
    });
  });
});

describe('admin point codes', () => {
  const policyRow: CouponPointPolicyRow = {
    id: 1,
    min_use_amount: 0,
    use_unit: 1,
    max_use_per_order: null,
    registration_attempt_limit: 5,
    registration_attempt_window_minutes: 10,
    updated_at: '2026-11-05T00:00:00Z',
  };

  it('maps the policy', () => {
    expect(toPointPolicyView(policyRow)).toEqual({
      minUseAmount: 0,
      useUnit: 1,
      maxUsePerOrder: null,
      registrationAttemptLimit: 5,
      registrationAttemptWindowMinutes: 10,
    });
  });

  it('refuses a policy outside the limits before calling the server', async () => {
    const update = vi.fn();
    await expect(
      savePointPolicy({ from: () => ({ update }) } as never, {
        minUseAmount: 0,
        useUnit: 0,
        maxUsePerOrder: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(update).not.toHaveBeenCalled();
  });

  it('maps the list and totals and never asks for the full code', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        codes: [
          {
            id: UUID,
            maskedCode: 'OLIVE-••••-AB23',
            amount: 5000,
            remaining: 0,
            status: 'EXHAUSTED',
            issuedAt: '2026-11-05T00:00:00Z',
            expiresAt: '2027-01-01T00:00:00Z',
            registeredAt: '2026-11-06T00:00:00Z',
            memo: '선물',
            batchId: UUID,
          },
        ],
        matching: 1,
        totals: { issued: 5000, used: 5000, remaining: 0 },
      },
      error: null,
    });
    const list = await fetchPointCodes({ rpc } as never, {
      status: null,
      search: ' ',
      limit: 100,
      offset: 0,
    });
    expect(rpc).toHaveBeenCalledWith('admin_list_point_codes', {
      p_status: undefined,
      p_search: undefined,
      p_limit: 100,
      p_offset: 0,
    });
    expect(list.codes[0]).toMatchObject({
      maskedCode: 'OLIVE-••••-AB23',
      status: 'EXHAUSTED',
      registeredAt: '2026-11-06T00:00:00Z',
    });
    expect(list.matching).toBe(1);
    expect(list.totals).toEqual({ issued: 5000, used: 5000, remaining: 0 });
  });

  it('reads an unknown status as a server fault', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        codes: [
          {
            id: UUID,
            maskedCode: 'x',
            amount: 1,
            remaining: 1,
            status: 'ODD',
            issuedAt: 'a',
            expiresAt: 'b',
            memo: '',
          },
        ],
        matching: 0,
        totals: { issued: 0, used: 0, remaining: 0 },
      },
      error: null,
    });
    await expect(
      fetchPointCodes({ rpc } as never, { status: null, search: '', limit: 1, offset: 0 }),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('issues codes through the RPC and refuses bad input first', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { batchId: UUID, codes: [{ id: UUID, code: 'OLIVE-AAAA-2222' }] },
      error: null,
    });
    const codes = await issuePointCodes({ rpc } as never, {
      amount: 5000,
      quantity: 1,
      expiresOn: '2027-01-01',
      memo: '',
    });
    expect(codes).toEqual([{ id: UUID, code: 'OLIVE-AAAA-2222' }]);
    expect(rpc).toHaveBeenCalledWith('admin_issue_point_codes', {
      p_amount: 5000,
      p_quantity: 1,
      p_expires_on: '2027-01-01',
      p_memo: '',
    });
    const never = vi.fn();
    await expect(
      issuePointCodes({ rpc: never } as never, {
        amount: 999,
        quantity: 1,
        expiresOn: '2027-01-01',
        memo: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(never).not.toHaveBeenCalled();
  });

  it('maps a void refused because the code was registered', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'CODE_ALREADY_REGISTERED' },
    });
    await expect(voidPointCode({ rpc } as never, UUID)).rejects.toMatchObject({
      code: 'CODE_ALREADY_REGISTERED',
    });
  });
});
