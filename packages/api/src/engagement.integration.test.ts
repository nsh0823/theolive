import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@theolive/types';

import {
  deleteAnnouncement,
  fetchAnnouncement,
  fetchAnnouncements,
  fetchAnnouncementsAdmin,
  saveAnnouncement,
  setAnnouncementStatus,
} from './announcements';
import { signInWithEmail } from './auth';
import type { TypedSupabaseClient } from './client';
import { userTopic } from './orderChannels';
import {
  confirmPayment,
  createCheckout,
  runTestPayment,
  type CheckoutInput,
  type CheckoutResult,
} from './payments';
import {
  fetchNotificationPreferences,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
  saveNotificationPreferences,
} from './notifications';
import { fetchRewardSummary } from './rewardSummary';
import { transitionOrder } from './staffOrders';

// Runs against the LOCAL Supabase stack with `supabase functions serve --env-file supabase/functions/.env` running.
// TEST PAYMENT GATEWAY ONLY. Each run signs up its own customers and creates its own announcements, so it needs no
// database reset and leaves the seed customers alone.
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const WAIT_STEPS = 60;
const WAIT_STEP_MS = 100;

function anonymousClient(): TypedSupabaseClient {
  if (!url || !anonKey) throw new Error('integration env missing');
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

function serviceClient(): TypedSupabaseClient {
  if (!url || !serviceKey) throw new Error('service key missing');
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}

async function signedIn(email: string) {
  const client = anonymousClient();
  await signInWithEmail(client, { email, password: SEED_PASSWORD });
  return client;
}

async function newCustomer() {
  const email = `engage-${randomUUID()}@theolive.local`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { nickname: '알림테스트' },
  });
  if (error) throw error;
  return { id: data.user.id, client: await signedIn(email) };
}

function input(): CheckoutInput {
  return {
    clientRequestId: randomUUID(),
    orderType: 'TAKEOUT',
    lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 1 }],
    userCouponId: null,
    pointsToUse: 0,
    paymentMethod: 'CARD',
    note: null,
  };
}

async function settle(customer: TypedSupabaseClient, checkout: CheckoutResult): Promise<void> {
  if (checkout.nextAction.type !== 'TEST_SHEET') return;
  const decision = await runTestPayment(customer, {
    checkoutToken: checkout.nextAction.checkoutToken,
    scenario: 'SUCCESS',
  });
  await confirmPayment(customer, {
    paymentId: checkout.paymentId,
    providerPaymentKey: decision.providerPaymentKey ?? '',
  });
}

async function waitUntil(check: () => boolean | Promise<boolean>): Promise<boolean> {
  for (let i = 0; i < WAIT_STEPS; i += 1) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
  return false;
}

describe.skipIf(!url || !anonKey || !serviceKey)(
  'notifications, announcements and the reward summary against local Supabase (TEST PG)',
  () => {
    it('notifies once per order event, hints the owner over user:<uid>, and respects preferences', async () => {
      const barista = await signedIn('barista@theolive.local');
      const { id: userId, client: customer } = await newCustomer();
      const other = await newCustomer();

      // The owner listens on user:<uid>; another customer is refused that topic.
      const hints: string[] = [];
      const channel = customer.channel(userTopic(userId), { config: { private: true } });
      channel.on('broadcast', { event: 'notification_created' }, (message) => {
        hints.push(JSON.stringify(Object.keys(message.payload as object).sort()));
      });
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        channel.subscribe((status) => {
          if (status !== ('SUBSCRIBING' as string)) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      expect(await fetchUnreadNotificationCount(customer, userId)).toBe(0);
      const checkout = await createCheckout(customer, input());
      await settle(customer, checkout);
      for (const [action, expectedStatus] of [
        ['ACCEPT', 'PAID'],
        ['START_PREPARING', 'ACCEPTED'],
        ['MARK_READY', 'PREPARING'],
        ['COMPLETE', 'READY'],
      ] as const) {
        await transitionOrder(barista, { orderId: checkout.orderId, action, expectedStatus });
      }
      // A repeated action is a replay and must not notify again.
      await transitionOrder(barista, {
        orderId: checkout.orderId,
        action: 'COMPLETE',
        expectedStatus: 'COMPLETED',
      });

      const list = await fetchNotifications(customer, userId);
      expect(list.map((item) => item.kind).sort()).toEqual([
        'ORDER',
        'ORDER',
        'ORDER',
        'ORDER',
        'PAYMENT',
        'STAMP',
      ]);
      const titles = list.filter((item) => item.kind === 'ORDER').map((item) => item.title);
      expect(titles.some((title) => title.startsWith('주문이 접수되었어요.'))).toBe(true);
      expect(titles.some((title) => title.includes('픽업대에서 메뉴를 픽업해 주세요.'))).toBe(true);
      expect(list.find((item) => item.kind === 'PAYMENT')?.orderId).toBe(checkout.orderId);
      expect(list.every((item) => !item.isRead)).toBe(true);
      expect(await fetchUnreadNotificationCount(customer, userId)).toBe(list.length);

      // The hint carried only the id and kind.
      expect(await waitUntil(() => hints.length >= 6)).toBe(true);
      expect(new Set(hints)).toEqual(new Set([JSON.stringify(['id', 'kind'])]));

      // Another customer sees none of it and cannot mark it read.
      expect(await fetchNotifications(other.client, userId)).toEqual([]);
      const firstId = list[0]?.id ?? '';
      expect(await markNotificationsRead(other.client, [firstId])).toBe(0);

      // Mark one, then all.
      expect(await markNotificationsRead(customer, [firstId])).toBe(1);
      expect(await markNotificationsRead(customer, [firstId])).toBe(0);
      expect(await markNotificationsRead(customer, null)).toBe(list.length - 1);
      expect(await fetchUnreadNotificationCount(customer, userId)).toBe(0);

      // Preferences: order updates off means the next order creates no notification, the stamp still counts.
      expect(await fetchNotificationPreferences(customer, userId)).toEqual({
        orderUpdates: true,
        notices: true,
      });
      await saveNotificationPreferences(customer, userId, { orderUpdates: false, notices: true });
      await saveNotificationPreferences(customer, userId, { orderUpdates: false, notices: true });
      expect(await fetchNotificationPreferences(customer, userId)).toEqual({
        orderUpdates: false,
        notices: true,
      });
      const quiet = await createCheckout(customer, input());
      await settle(customer, quiet);
      expect((await fetchNotifications(customer, userId)).length).toBe(list.length);
      await saveNotificationPreferences(customer, userId, { orderUpdates: true, notices: true });
      await transitionOrder(barista, {
        orderId: quiet.orderId,
        action: 'ACCEPT',
        expectedStatus: 'PAID',
      });
      expect((await fetchNotifications(customer, userId)).length).toBe(list.length + 1);

      // A customer cannot write someone else's preferences.
      await expect(
        saveNotificationPreferences(other.client, userId, { orderUpdates: false, notices: false }),
      ).rejects.toBeDefined();
      expect(await fetchNotificationPreferences(customer, userId)).toEqual({
        orderUpdates: true,
        notices: true,
      });

      // The summary: separate stamp and point fields from one call.
      expect(await fetchRewardSummary(customer)).toMatchObject({
        stamps: { balance: 1 },
        points: { balance: 0, available: 0 },
        availableCouponCount: 0,
      });
      await customer.removeChannel(channel);
    }, 120_000);

    it('shows only published announcements to customers, stamps the date, and notifies once', async () => {
      const admin = await signedIn('admin@theolive.local');
      const staff = await signedIn('staff@theolive.local');
      const { id: userId, client: customer } = await newCustomer();
      const title = `IT 공지 ${randomUUID().slice(0, 8)}`;

      await saveAnnouncement(admin, { id: null, title, body: '본문', status: 'UNPUBLISHED' });
      const draft = (await fetchAnnouncementsAdmin(admin)).find((item) => item.title === title);
      expect(draft).toMatchObject({ status: 'UNPUBLISHED', publishedAt: null });
      const id = draft?.id ?? '';
      expect((await fetchAnnouncements(customer)).some((item) => item.id === id)).toBe(false);
      expect(await fetchAnnouncement(customer, id)).toBeNull();

      await setAnnouncementStatus(admin, id, 'PUBLISHED');
      expect((await fetchAnnouncements(customer)).find((item) => item.id === id)).toMatchObject({
        title,
        status: 'PUBLISHED',
      });
      expect((await fetchAnnouncement(customer, id))?.publishedAt).not.toBeNull();
      const countNotices = async () =>
        (await fetchNotifications(customer, userId)).filter((item) => item.title === title).length;
      expect(await countNotices()).toBe(1);
      await setAnnouncementStatus(admin, id, 'UNPUBLISHED');
      expect(await fetchAnnouncement(customer, id)).toBeNull();
      await setAnnouncementStatus(admin, id, 'PUBLISHED');
      // Publishing, unpublishing and publishing again notified the member exactly once.
      expect(await countNotices()).toBe(1);
      expect(
        (await fetchNotifications(customer, userId)).find((item) => item.title === title)?.kind,
      ).toBe('NOTICE');

      // Staff and customers cannot write.
      await expect(
        saveAnnouncement(staff, { id: null, title: 'x', body: 'y', status: 'PUBLISHED' }),
      ).rejects.toBeDefined();
      await expect(
        saveAnnouncement(customer, { id: null, title: 'x', body: 'y', status: 'PUBLISHED' }),
      ).rejects.toBeDefined();
      await deleteAnnouncement(customer, id);
      expect((await fetchAnnouncementsAdmin(admin)).some((item) => item.id === id)).toBe(true);

      await deleteAnnouncement(admin, id);
      expect((await fetchAnnouncementsAdmin(admin)).some((item) => item.id === id)).toBe(false);
    }, 60_000);
  },
);
