import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { APP_ERROR, type Database } from '@theolive/types';

import { signInWithEmail } from './auth';
import {
  archiveMenuItem,
  removeMenuImage,
  reorderCategories,
  saveBusinessHours,
  saveMenuItem,
  setMenuItemSoldOut,
  setStoreStatus,
  uploadMenuImage,
} from './catalogMutations';
import { CATALOG_EVENT, CATALOG_TOPIC } from './catalogChannel';
import type { TypedSupabaseClient } from './client';
import { fetchMenuCategories, fetchMenuItem, fetchMenuItems } from './menu';
import { fetchBusinessHours, fetchStoreSettings } from './store';

// Runs against the LOCAL Supabase stack with the seeded accounts and menu (supabase/seed.sql).
//   SUPABASE_INTEGRATION_URL=http://127.0.0.1:54321 SUPABASE_INTEGRATION_ANON_KEY=<publishable key> pnpm --filter @theolive/api test
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const COFFEE = '00000000-0000-4000-8000-000000000101';

function anonymousClient(): TypedSupabaseClient {
  if (!url || !anonKey) throw new Error('integration env missing');
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

async function signedInClient(email: string): Promise<TypedSupabaseClient> {
  const client = anonymousClient();
  await signInWithEmail(client, { email, password: SEED_PASSWORD });
  return client;
}

// 1x1 transparent PNG.
const PNG_BYTES = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

describe.skipIf(!url || !anonKey)('catalog against local Supabase', () => {
  it('anonymous and customer callers read the seeded visible menu', async () => {
    for (const client of [anonymousClient(), await signedInClient('customer1@theolive.local')]) {
      const items = await fetchMenuItems(client);
      expect(items.length).toBeGreaterThanOrEqual(9);
      expect(items.find((item) => item.id === AMERICANO)).toMatchObject({
        name: '아메리카노',
        price: 4500,
        temperatures: ['HOT', 'ICE'],
      });
      expect(
        (await fetchMenuCategories(client)).map((category) => category.name).slice(0, 2),
      ).toEqual(['커피', '라떼']);
    }
  });

  it('customer cannot change store status, sold-out or save items', async () => {
    const customer = await signedInClient('customer1@theolive.local');
    await expect(setStoreStatus(customer, { isOpen: false })).rejects.toMatchObject({
      code: APP_ERROR.FORBIDDEN,
    });
    await expect(setMenuItemSoldOut(customer, AMERICANO, true)).rejects.toMatchObject({
      code: APP_ERROR.FORBIDDEN,
    });
    await expect(
      saveMenuItem(customer, {
        id: null,
        fields: {
          name: 'x',
          description: '',
          price: 1000,
          categoryId: COFFEE,
          temperatures: [],
          isActive: true,
          imagePath: null,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('staff without MANAGE_OPERATIONS is denied, staff with it toggles sold-out and status', async () => {
    const barista = await signedInClient('barista@theolive.local');
    await expect(setMenuItemSoldOut(barista, AMERICANO, true)).rejects.toMatchObject({
      code: APP_ERROR.FORBIDDEN,
    });
    const staff = await signedInClient('staff@theolive.local');
    await setMenuItemSoldOut(staff, AMERICANO, true);
    expect((await fetchMenuItem(anonymousClient(), AMERICANO))?.isSoldOut).toBe(true);
    await setMenuItemSoldOut(staff, AMERICANO, false);
    expect((await fetchMenuItem(anonymousClient(), AMERICANO))?.isSoldOut).toBe(false);

    await setStoreStatus(staff, { isAcceptingOrders: false });
    expect((await fetchStoreSettings(staff)).status).toEqual({
      isOpen: true,
      isAcceptingOrders: false,
    });
    await setStoreStatus(staff, { isAcceptingOrders: true });
  });

  it('receives store:catalog broadcasts after a sold-out change', async () => {
    const customer = await signedInClient('customer1@theolive.local');
    const staff = await signedInClient('staff@theolive.local');
    const received = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no broadcast within 8s')), 8000);
      const channel = customer
        .channel(CATALOG_TOPIC, { config: { private: true } })
        .on('broadcast', { event: CATALOG_EVENT.MENU_UPDATED }, (message) => {
          clearTimeout(timer);
          resolve(String((message.payload as { menuItemId?: string }).menuItemId));
          void customer.removeChannel(channel);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void setMenuItemSoldOut(staff, AMERICANO, false);
        });
    });
    await expect(received).resolves.toBe(AMERICANO);
  });

  it('admin creates, edits and archives an item with an image; customers see only the live state', async () => {
    const admin = await signedInClient('admin@theolive.local');
    const imagePath = await uploadMenuImage(
      admin,
      new Blob([PNG_BYTES], { type: 'image/png' }) as never,
    );
    const id = await saveMenuItem(admin, {
      id: null,
      fields: {
        name: '통합 테스트 라떼',
        description: '삭제 예정',
        price: 5900,
        categoryId: COFFEE,
        temperatures: [],
        isActive: true,
        imagePath,
      },
    });
    const customer = await signedInClient('customer1@theolive.local');
    const visible = await fetchMenuItem(customer, id);
    expect(visible).toMatchObject({ name: '통합 테스트 라떼', temperatures: [], imagePath });
    const image = await fetch(visible?.imageUrl ?? '');
    expect(image.status).toBe(200);

    await archiveMenuItem(admin, id);
    expect(await fetchMenuItem(customer, id)).toBeNull();
    expect((await fetchMenuItems(admin)).some((item) => item.id === id)).toBe(false);
    await removeMenuImage(admin, imagePath);
    expect((await fetch(visible?.imageUrl ?? '')).status).toBe(400);
  });

  it('customer and staff cannot upload images', async () => {
    for (const email of ['customer1@theolive.local', 'staff@theolive.local']) {
      const client = await signedInClient(email);
      await expect(
        uploadMenuImage(client, new Blob([PNG_BYTES], { type: 'image/png' }) as never),
      ).rejects.toBeDefined();
    }
  });

  it('admin saves business hours and the category order; staff cannot', async () => {
    const admin = await signedInClient('admin@theolive.local');
    const hours = await fetchBusinessHours(admin);
    expect(hours).toHaveLength(7);
    await saveBusinessHours(admin, hours);
    const staff = await signedInClient('staff@theolive.local');
    await expect(saveBusinessHours(staff, hours)).rejects.toBeDefined();
    const categories = await fetchMenuCategories(admin);
    await reorderCategories(
      admin,
      categories.map((category) => category.id),
    );
    await expect(
      reorderCategories(
        staff,
        categories.map((category) => category.id),
      ),
    ).rejects.toMatchObject({
      code: APP_ERROR.FORBIDDEN,
    });
  });
});
