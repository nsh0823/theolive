import { describe, expect, it, vi } from 'vitest';
import { APP_ERROR } from '@theolive/types';

import {
  archiveMenuItem,
  saveBusinessHours,
  saveCategoryList,
  saveMenuItem,
  setMenuItemSoldOut,
  setStoreStatus,
  uploadMenuImage,
} from './catalogMutations';
import { fetchMenuItems, toMenuItemView } from './menu';
import { toBusinessHoursView, toHourMinute, toStoreSettingsView } from './store';

const CATEGORY_ID = '00000000-0000-4000-8000-000000000101';
const ITEM_ID = '00000000-0000-4000-8000-000000000201';

const itemRow = {
  id: ITEM_ID,
  category_id: CATEGORY_ID,
  name: '아메리카노',
  description: '',
  price: 4500,
  temperatures: ['HOT', 'ICE'] as ('HOT' | 'ICE')[],
  image_path: 'a.png',
  is_sold_out: false,
  is_active: true,
  sort_order: 1,
  archived_at: null,
  created_at: '2026-11-05T00:00:00Z',
  updated_at: '2026-11-05T00:00:00Z',
};

/** Minimal fake of the PostgREST builder: every method returns the builder; awaiting it yields `result`. */
function fakeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'upsert', 'eq', 'is', 'order']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const validFields = {
  name: '플랫 화이트',
  description: '',
  price: 5300,
  categoryId: CATEGORY_ID,
  temperatures: ['HOT' as const],
  isActive: true,
  imagePath: null,
};

describe('mappers', () => {
  it('maps a menu row and builds the public image URL', () => {
    const view = toMenuItemView(itemRow, (path) => `https://img/${path}`);
    expect(view).toMatchObject({
      id: ITEM_ID,
      categoryId: CATEGORY_ID,
      isSoldOut: false,
      imageUrl: 'https://img/a.png',
      temperatures: ['HOT', 'ICE'],
    });
    expect(toMenuItemView({ ...itemRow, image_path: null }, () => 'x').imageUrl).toBeNull();
  });

  it('trims Postgres time to HH:MM', () => {
    expect(toHourMinute('08:00:00')).toBe('08:00');
    expect(
      toBusinessHoursView({
        weekday: 6,
        is_closed: true,
        opens_at: '08:00:00',
        closes_at: '21:30:00',
        updated_at: '',
      }),
    ).toEqual({ weekday: 6, isClosed: true, opensAt: '08:00', closesAt: '21:30' });
  });

  it('maps store settings into info, status and notification groups', () => {
    const view = toStoreSettingsView({
      id: 1,
      name: '올리브',
      phone: '1',
      address: '2',
      description: '3',
      is_open: true,
      is_accepting_orders: false,
      pending_payment_ttl_minutes: 15,
      new_order_sound: true,
      new_order_banner: false,
      sold_out_reminder: true,
      daily_summary: false,
      updated_at: '',
      updated_by: null,
    });
    expect(view.status).toEqual({ isOpen: true, isAcceptingOrders: false });
    expect(view.notifications.newOrderBanner).toBe(false);
    expect(view.info.name).toBe('올리브');
  });
});

describe('fetchMenuItems', () => {
  const storage = {
    from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `u/${p}` } }) }),
  };

  it('excludes archived items and maps rows', async () => {
    const builder = fakeBuilder({ data: [itemRow], error: null });
    const client = { from: vi.fn(() => builder), storage } as never;
    await expect(fetchMenuItems(client)).resolves.toMatchObject([
      { id: ITEM_ID, imageUrl: 'u/a.png' },
    ]);
    expect(builder.is).toHaveBeenCalledWith('archived_at', null);
  });

  it('throws the server error so the screen can show the error state', async () => {
    const client = {
      from: () => fakeBuilder({ data: null, error: { message: 'boom' } }),
      storage,
    } as never;
    await expect(fetchMenuItems(client)).rejects.toEqual({ message: 'boom' });
  });
});

describe('store and sold-out RPCs', () => {
  it('passes only the switches that were given', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await setStoreStatus({ rpc } as never, { isOpen: false });
    expect(rpc).toHaveBeenCalledWith('set_store_status', {
      p_is_open: false,
      p_is_accepting_orders: undefined,
    });
  });

  it('turns a FORBIDDEN rejection into an AppError', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'FORBIDDEN', code: 'P0001' } });
    await expect(setMenuItemSoldOut({ rpc } as never, ITEM_ID, true)).rejects.toMatchObject({
      code: APP_ERROR.FORBIDDEN,
    });
  });
});

describe('saveMenuItem', () => {
  it('inserts a new item with snake_case columns', async () => {
    const builder = fakeBuilder({ data: { id: ITEM_ID }, error: null });
    const client = { from: vi.fn(() => builder) } as never;
    await expect(saveMenuItem(client, { id: null, fields: validFields })).resolves.toBe(ITEM_ID);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: CATEGORY_ID, price: 5300, temperatures: ['HOT'] }),
    );
  });

  it('updates an existing item by id', async () => {
    const builder = fakeBuilder({ data: { id: ITEM_ID }, error: null });
    await saveMenuItem({ from: () => builder } as never, { id: ITEM_ID, fields: validFields });
    expect(builder.update).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', ITEM_ID);
  });

  it('rejects invalid fields before calling the server', async () => {
    const from = vi.fn();
    await expect(
      saveMenuItem({ from } as never, { id: null, fields: { ...validFields, price: 0 } }),
    ).rejects.toMatchObject({ code: APP_ERROR.INVALID_INPUT });
    expect(from).not.toHaveBeenCalled();
  });

  it('maps a database failure to an AppError', async () => {
    const builder = fakeBuilder({ data: null, error: { message: 'x', code: '42501' } });
    await expect(
      saveMenuItem({ from: () => builder } as never, { id: null, fields: validFields }),
    ).rejects.toMatchObject({ code: APP_ERROR.INTERNAL });
  });

  it('archives instead of deleting', async () => {
    const builder = fakeBuilder({ data: null, error: null });
    const from = vi.fn(() => builder);
    await archiveMenuItem({ from } as never, ITEM_ID);
    expect(builder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(builder).not.toHaveProperty('delete');
  });
});

describe('saveCategoryList', () => {
  it('saves changed and new categories, then the order of all of them', async () => {
    const existing = '00000000-0000-4000-8000-000000000102';
    const inserted = '00000000-0000-4000-8000-000000000106';
    const builder = fakeBuilder({ data: { id: inserted }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    await saveCategoryList(
      { from: () => builder, rpc } as never,
      [
        { id: existing, name: '라떼', isActive: true },
        { id: null, name: '시즌', isActive: true },
      ],
      [{ id: existing, name: '라떼', isActive: true }],
    );
    expect(builder.insert).toHaveBeenCalledTimes(1);
    expect(builder.update).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('admin_reorder_categories', { p_ids: [existing, inserted] });
  });

  it('rejects an empty name without touching the server', async () => {
    const from = vi.fn();
    await expect(
      saveCategoryList(
        { from, rpc: vi.fn() } as never,
        [{ id: null, name: '  ', isActive: true }],
        [],
      ),
    ).rejects.toMatchObject({ code: APP_ERROR.INVALID_INPUT });
    expect(from).not.toHaveBeenCalled();
  });
});

describe('saveBusinessHours and uploadMenuImage', () => {
  const week = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isClosed: false,
    opensAt: '08:00',
    closesAt: '21:00',
  }));

  it('upserts the whole week in one statement', async () => {
    const builder = fakeBuilder({ data: null, error: null });
    await saveBusinessHours({ from: () => builder } as never, week);
    expect(builder.upsert).toHaveBeenCalledTimes(1);
    expect((builder.upsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toHaveLength(7);
  });

  it('refuses a week where closing is before opening', async () => {
    const bad = week.map((day) => (day.weekday === 0 ? { ...day, closesAt: '07:00' } : day));
    await expect(saveBusinessHours({ from: vi.fn() } as never, bad)).rejects.toMatchObject({
      code: APP_ERROR.INVALID_INPUT,
    });
  });

  it('refuses unsupported or oversized images before uploading', async () => {
    const storage = { from: vi.fn() };
    await expect(
      uploadMenuImage({ storage } as never, new Blob(['x'], { type: 'image/gif' }) as never),
    ).rejects.toMatchObject({ code: APP_ERROR.INVALID_INPUT });
    const big = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' });
    await expect(uploadMenuImage({ storage } as never, big as never)).rejects.toMatchObject({
      code: APP_ERROR.INVALID_INPUT,
    });
    expect(storage.from).not.toHaveBeenCalled();
  });

  it('uploads a valid image under a new name and returns the path', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storage = { from: () => ({ upload }) };
    const path = await uploadMenuImage(
      { storage } as never,
      new Blob(['x'], { type: 'image/webp' }) as never,
    );
    expect(path).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(upload).toHaveBeenCalledWith(path, expect.anything(), {
      contentType: 'image/webp',
      upsert: false,
    });
  });
});
