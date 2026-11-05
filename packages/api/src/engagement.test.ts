import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { AnnouncementRow, NotificationRow } from '@theolive/types';

import { AppError } from './functionErrors';
import { deleteAccount } from './account';
import { saveAnnouncement, setAnnouncementStatus, toAnnouncementView } from './announcements';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
  saveNotificationPreferences,
  toNotificationView,
} from './notifications';
import { fetchRewardSummary } from './rewardSummary';

const UUID = '00000000-0000-4000-8000-0000000000e1';

/** A query builder whose every step returns itself and which resolves to `result` when awaited. */
function builder(result: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const target: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(target, {
    get(_object, property) {
      if (property === 'then') {
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      if (property === 'calls') return calls;
      return (...args: unknown[]) => {
        calls.push({ method: String(property), args });
        return proxy;
      };
    },
  });
  return proxy as { calls: typeof calls };
}

const notificationRow: NotificationRow = {
  id: UUID,
  user_id: UUID,
  kind: 'ORDER',
  title: '주문이 접수되었어요. (A-1)',
  body: '',
  order_id: UUID,
  is_read: false,
  created_at: '2026-11-05T10:00:00Z',
  dedupe_key: 'order:x:ACCEPTED',
};

const announcementRow: AnnouncementRow = {
  id: UUID,
  title: '공지',
  body: '본문',
  status: 'PUBLISHED',
  published_at: '2026-11-05T10:00:00Z',
  created_by: UUID,
  created_at: '2026-11-05T09:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
};

describe('notifications', () => {
  it('maps a row and drops the dedupe key and the owner', () => {
    expect(toNotificationView(notificationRow)).toEqual({
      id: UUID,
      kind: 'ORDER',
      title: '주문이 접수되었어요. (A-1)',
      body: '',
      orderId: UUID,
      isRead: false,
      createdAt: '2026-11-05T10:00:00Z',
    });
  });

  it('lists the newest first for the given member', async () => {
    const query = builder({ data: [notificationRow], error: null });
    const result = await fetchNotifications({ from: () => query } as never, UUID);
    expect(result).toHaveLength(1);
    expect(query.calls.find((call) => call.method === 'eq')?.args).toEqual(['user_id', UUID]);
    expect(query.calls.filter((call) => call.method === 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ]);
  });

  it('counts unread without downloading rows', async () => {
    const query = builder({ count: 3, error: null });
    expect(await fetchUnreadNotificationCount({ from: () => query } as never, UUID)).toBe(3);
    expect(query.calls[0]?.args[1]).toEqual({ count: 'exact', head: true });
    expect(
      await fetchUnreadNotificationCount(
        { from: () => builder({ count: null, error: null }) } as never,
        UUID,
      ),
    ).toBe(0);
  });

  it('marks given ids, or all when null', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { updated: 2 }, error: null });
    expect(await markNotificationsRead({ rpc } as never, ['a'])).toBe(2);
    expect(rpc).toHaveBeenLastCalledWith('mark_notifications_read', { p_ids: ['a'] });
    await markNotificationsRead({ rpc } as never, null);
    expect(rpc).toHaveBeenLastCalledWith('mark_notifications_read', { p_ids: undefined });
  });

  it('rejects a garbage count as a server fault and maps RPC errors', async () => {
    const garbage = vi.fn().mockResolvedValue({ data: { updated: 'x' }, error: null });
    await expect(markNotificationsRead({ rpc: garbage } as never, null)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    const failing = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'P0001', message: 'UNAUTHENTICATED' } });
    await expect(markNotificationsRead({ rpc: failing } as never, null)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('defaults both preferences to on when no row exists', async () => {
    const query = builder({ data: null, error: null });
    expect(await fetchNotificationPreferences({ from: () => query } as never, UUID)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
  });

  it('reads stored preferences', async () => {
    const query = builder({ data: { order_updates: false, notices: true }, error: null });
    expect(await fetchNotificationPreferences({ from: () => query } as never, UUID)).toEqual({
      orderUpdates: false,
      notices: true,
    });
  });

  it('updates an existing preference row and inserts only when none was updated', async () => {
    const update = builder({ data: [{ user_id: UUID }], error: null });
    const fromExisting = vi.fn(() => update);
    await saveNotificationPreferences({ from: fromExisting } as never, UUID, {
      orderUpdates: false,
      notices: true,
    });
    expect(fromExisting).toHaveBeenCalledTimes(1);
    expect(update.calls[0]).toEqual({
      method: 'update',
      args: [{ order_updates: false, notices: true }],
    });

    const empty = builder({ data: [], error: null });
    const fromNew = vi.fn(() => empty);
    await saveNotificationPreferences({ from: fromNew } as never, UUID, {
      orderUpdates: true,
      notices: false,
    });
    expect(fromNew).toHaveBeenCalledTimes(2);
    expect(empty.calls.some((call) => call.method === 'insert')).toBe(true);
  });

  it('surfaces a rejected write with its app code', async () => {
    const query = builder({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(
      saveNotificationPreferences({ from: () => query } as never, UUID, {
        orderUpdates: true,
        notices: true,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('announcements', () => {
  it('maps a row', () => {
    expect(toAnnouncementView(announcementRow)).toEqual({
      id: UUID,
      title: '공지',
      body: '본문',
      status: 'PUBLISHED',
      publishedAt: '2026-11-05T10:00:00Z',
      createdAt: '2026-11-05T09:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    });
  });

  it('refuses an empty title, an empty body and an over-long title before calling the server', async () => {
    const from = vi.fn();
    for (const input of [
      { id: null, title: ' ', body: 'b', status: 'PUBLISHED' as const },
      { id: null, title: 't', body: '', status: 'PUBLISHED' as const },
      { id: null, title: '가'.repeat(61), body: 'b', status: 'UNPUBLISHED' as const },
    ]) {
      await expect(saveAnnouncement({ from } as never, input)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('inserts a new announcement without a date and updates an existing one by id', async () => {
    const insert = builder({ error: null });
    await saveAnnouncement({ from: () => insert } as never, {
      id: null,
      title: ' 제목 ',
      body: '본문',
      status: 'UNPUBLISHED',
    });
    expect(insert.calls[0]).toEqual({
      method: 'insert',
      args: [{ title: '제목', body: '본문', status: 'UNPUBLISHED' }],
    });
    const update = builder({ error: null });
    await saveAnnouncement({ from: () => update } as never, {
      id: UUID,
      title: '제목',
      body: '본문',
      status: 'PUBLISHED',
    });
    expect(update.calls.map((call) => call.method)).toEqual(['update', 'eq']);
  });

  it('only ever sends the status when publishing or unpublishing', async () => {
    const update = builder({ error: null });
    await setAnnouncementStatus({ from: () => update } as never, UUID, 'UNPUBLISHED');
    expect(update.calls[0]).toEqual({ method: 'update', args: [{ status: 'UNPUBLISHED' }] });
  });
});

describe('deleteAccount', () => {
  it('sends only the confirmation, never an id', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteAccount({ functions: { invoke } } as never);
    expect(invoke).toHaveBeenCalledWith('account-delete', { body: { confirm: true } });
  });

  it('turns a refusal into an AppError with the server code', async () => {
    const response = new Response(
      JSON.stringify({ error: { code: 'ACTIVE_ORDER_EXISTS', message: 'x' } }),
      { status: 409 },
    );
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: null, error: new FunctionsHttpError(response) });
    await expect(deleteAccount({ functions: { invoke } } as never)).rejects.toMatchObject({
      code: 'ACTIVE_ORDER_EXISTS',
    });
  });
});

describe('fetchRewardSummary (HOME-04)', () => {
  it('reads the server numbers as separate stamp and point fields', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        stamps: { balance: 7, nextGoal: 10 },
        points: { balance: 12000, available: 9000 },
        availableCouponCount: 1,
      },
      error: null,
    });
    expect(await fetchRewardSummary({ rpc } as never)).toEqual({
      stamps: { balance: 7, nextGoal: 10 },
      points: { balance: 12000, available: 9000 },
      availableCouponCount: 1,
    });
  });

  it('keeps a missing goal as null (no active reward)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        stamps: { balance: 0, nextGoal: null },
        points: { balance: 0, available: 0 },
        availableCouponCount: 0,
      },
      error: null,
    });
    expect((await fetchRewardSummary({ rpc } as never)).stamps.nextGoal).toBeNull();
  });

  it('treats a garbage number as a server fault', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        stamps: { balance: 'x', nextGoal: 1 },
        points: { balance: 0, available: 0 },
        availableCouponCount: 0,
      },
      error: null,
    });
    await expect(fetchRewardSummary({ rpc } as never)).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
