import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@theolive/types';

import { deleteAccount } from './account';
import { signInWithEmail } from './auth';
import type { TypedSupabaseClient } from './client';
import { fetchMember, fetchMembers } from './members';
import { cancelMyOrder, fetchOrder } from './orders';
import {
  confirmPayment,
  createCheckout,
  runTestPayment,
  type CheckoutInput,
  type CheckoutResult,
} from './payments';
import { fetchPointSummary, registerPointCode } from './points';
import { issuePointCodes } from './pointsAdmin';
import { fetchPopularItems, fetchSalesSummary } from './reporting';
import { transitionOrder } from './staffOrders';

// Runs against the LOCAL Supabase stack with `supabase functions serve --env-file supabase/functions/.env` running.
// TEST PAYMENT GATEWAY ONLY. Each run signs up its own customers, so it needs no database reset and leaves the seed
// customers alone.
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const AMERICANO_PRICE = 4500;
const POINT_AMOUNT = 5000;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const KST_OFFSET_HOURS = 9;
const POPULAR_LIMIT = 20;

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

async function newCustomer(nickname = '탈퇴테스트') {
  const email = `account-${randomUUID()}@theolive.local`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { nickname },
  });
  if (error) throw error;
  return { id: data.user.id, email, client: await signedIn(email) };
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

/** Today's Asia/Seoul business date, `YYYY-MM-DD`. */
function kstToday(): string {
  return new Date(Date.now() + KST_OFFSET_HOURS * MS_PER_HOUR).toISOString().slice(0, 10);
}

function kstDaysAgo(days: number): string {
  return new Date(Date.now() + KST_OFFSET_HOURS * MS_PER_HOUR - days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

describe.skipIf(!url || !anonKey || !serviceKey)(
  'account deletion, sales and members against local Supabase (TEST PG)',
  () => {
    it('deletes an account: refused while an order is active, then forfeits, scrubs, retains and ends the login', async () => {
      const admin = await signedIn('admin@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const service = serviceClient();
      const { id, email, client } = await newCustomer('ZQX탈퇴통합');

      // Rewards on both separate ledgers: one stamp (from a completed order) and a registered point code.
      const expiresOn = new Date(Date.now() + 30 * MS_PER_DAY).toISOString().slice(0, 10);
      const [code] = await issuePointCodes(admin, {
        amount: POINT_AMOUNT,
        quantity: 1,
        expiresOn,
        memo: `it-${randomUUID().slice(0, 8)}`,
      });
      await registerPointCode(client, code?.code ?? '');

      const order = await createCheckout(client, input());
      await settle(client, order);
      await expect(deleteAccount(client)).rejects.toMatchObject({ code: 'ACTIVE_ORDER_EXISTS' });
      expect((await fetchPointSummary(client)).balance).toBe(POINT_AMOUNT);

      for (const [action, expectedStatus] of [
        ['ACCEPT', 'PAID'],
        ['START_PREPARING', 'ACCEPTED'],
        ['MARK_READY', 'PREPARING'],
        ['COMPLETE', 'READY'],
      ] as const) {
        await transitionOrder(barista, { orderId: order.orderId, action, expectedStatus });
      }
      const unpaid = await createCheckout(client, input());

      await deleteAccount(client);

      // Both ledgers were forfeited to zero, each in its own table.
      const stampRows = await service
        .from('stamp_transactions')
        .select('kind, delta')
        .eq('user_id', id);
      expect(stampRows.data?.filter((row) => row.kind === 'FORFEIT')).toEqual([
        { kind: 'FORFEIT', delta: -1 },
      ]);
      const pointRows = await service
        .from('coupon_point_transactions')
        .select('kind, delta')
        .eq('user_id', id);
      expect(pointRows.data?.filter((row) => row.kind === 'FORFEIT')).toEqual([
        { kind: 'FORFEIT', delta: -POINT_AMOUNT },
      ]);
      const balances = await Promise.all([
        service.from('stamp_balances').select('balance').eq('user_id', id).single(),
        service.from('coupon_point_balances').select('balance').eq('user_id', id).single(),
      ]);
      expect(balances.map((result) => result.data?.balance)).toEqual([0, 0]);

      // Personal data is scrubbed, the profile and auth user are kept, orders and payments are retained.
      const profile = await service
        .from('profiles')
        .select('nickname, deleted_at')
        .eq('id', id)
        .single();
      expect(profile.data?.nickname).toBe('탈퇴한 회원');
      expect(profile.data?.deleted_at).not.toBeNull();
      const authUser = await service.auth.admin.getUserById(id);
      expect(authUser.data.user?.email).not.toBe(email);
      expect(authUser.data.user?.email).toMatch(/@deleted\.invalid$/);
      const kept = await service.from('orders').select('id, status').eq('customer_id', id);
      expect(kept.data?.find((row) => row.id === order.orderId)?.status).toBe('COMPLETED');
      expect(kept.data?.find((row) => row.id === unpaid.orderId)?.status).toBe('CANCELLED');
      expect(
        (await service.from('payments').select('id').eq('order_id', order.orderId)).data,
      ).toHaveLength(1);

      // The login is over: no sign-in, and the old session reads nothing.
      await expect(
        signInWithEmail(anonymousClient(), { email, password: SEED_PASSWORD }),
      ).rejects.toBeDefined();
      expect(await fetchOrder(client, order.orderId).catch(() => null)).toBeNull();
      const readable = await client.from('profiles').select('id');
      expect(readable.data ?? []).toEqual([]);
      await expect(createCheckout(client, input())).rejects.toBeDefined();

      // Repeating the call is harmless: either a replay, or the session is already gone.
      const again = await deleteAccount(client).then(
        () => 'ok',
        (error: { code?: string }) => error.code,
      );
      expect(['ok', 'UNAUTHENTICATED']).toContain(again);
      expect(
        (
          await service
            .from('stamp_transactions')
            .select('id')
            .eq('user_id', id)
            .eq('kind', 'FORFEIT')
        ).data,
      ).toHaveLength(1);

      // The admin no longer lists the member.
      expect(
        (await fetchMembers(admin, { search: 'ZQX탈퇴통합', limit: 10, offset: 0 })).total,
      ).toBe(0);
    }, 120_000);

    it('reports sales as paid minus refunded for the Seoul business day, and masks members for admins only', async () => {
      const admin = await signedIn('admin@theolive.local');
      const staff = await signedIn('staff@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const nickname = `ZQX회원${randomUUID().slice(0, 6)}`;
      const { id, email, client } = await newCustomer(nickname);
      const today = kstToday();
      const week = kstDaysAgo(6);

      const before = await fetchSalesSummary(admin, week, today);
      expect(before.days).toHaveLength(7);
      expect(before.days.at(-1)?.date).toBe(today);
      expect(before.days.map((day) => day.date)).toEqual(
        [...before.days.map((day) => day.date)].sort(),
      );

      // A paid order is counted from the moment it is paid, and completing it changes nothing.
      const baseline = await fetchSalesSummary(admin, today, today);
      const done = await createCheckout(client, input());
      await settle(client, done);
      const afterPay = await fetchSalesSummary(admin, today, today);
      expect(afterPay.total).toBe(baseline.total + AMERICANO_PRICE);
      expect(afterPay.orderCount).toBe(baseline.orderCount + 1);
      for (const [action, expectedStatus] of [
        ['ACCEPT', 'PAID'],
        ['START_PREPARING', 'ACCEPTED'],
        ['MARK_READY', 'PREPARING'],
        ['COMPLETE', 'READY'],
      ] as const) {
        await transitionOrder(barista, { orderId: done.orderId, action, expectedStatus });
      }
      const afterOne = await fetchSalesSummary(admin, today, today);
      expect(afterOne.total).toBe(afterPay.total);
      expect(afterOne.orderCount).toBe(afterPay.orderCount);

      // A cancelled (refunded) order is not counted, an unpaid checkout is not counted.
      const cancelled = await createCheckout(client, input());
      await settle(client, cancelled);
      const withPaid = await fetchSalesSummary(admin, today, today);
      expect(withPaid.total).toBe(afterOne.total + AMERICANO_PRICE);
      expect(withPaid.orderCount).toBe(afterOne.orderCount + 1);
      await cancelMyOrder(client, { orderId: cancelled.orderId, expectedStatus: 'PAID' });
      await createCheckout(client, input());
      const settled = await fetchSalesSummary(admin, today, today);
      expect(settled.total).toBe(afterOne.total);
      expect(settled.orderCount).toBe(afterOne.orderCount);
      expect(settled.averageAmount).toBe(
        settled.orderCount === 0 ? 0 : Math.round(settled.total / settled.orderCount),
      );
      expect(
        (await fetchPopularItems(admin, week, today, POPULAR_LIMIT)).some(
          (item) => item.name === '아메리카노',
        ),
      ).toBe(true);

      // Members: masked, found by nickname, never by email; admin only.
      const list = await fetchMembers(admin, { search: nickname, limit: 10, offset: 0 });
      expect(list.total).toBe(1);
      const member = list.members[0];
      expect(member?.id).toBe(id);
      expect(member?.maskedEmail).toContain('***@');
      expect(JSON.stringify(list)).not.toContain(email);
      expect((await fetchMembers(admin, { search: email, limit: 10, offset: 0 })).total).toBe(0);
      const detail = await fetchMember(admin, id);
      expect(JSON.stringify(detail)).not.toContain(email);
      expect(detail.stampBalance).toBe(1);
      expect(detail.stampLedger.map((entry) => entry.kind)).toEqual(['EARN']);
      expect(detail.pointLedger).toEqual([]);
      expect(detail.orders.map((order) => order.id)).toContain(done.orderId);
      expect(detail.totalSpent).toBe(AMERICANO_PRICE);

      for (const denied of [staff, barista, client]) {
        await expect(
          fetchMembers(denied, { search: '', limit: 10, offset: 0 }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(fetchMember(denied, id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(fetchSalesSummary(denied, today, today)).rejects.toMatchObject({
          code: 'FORBIDDEN',
        });
      }
      await expect(
        fetchMembers(anonymousClient(), { search: '', limit: 10, offset: 0 }),
      ).rejects.toBeDefined();
    }, 120_000);
  },
);
