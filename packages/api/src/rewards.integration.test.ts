import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database, OrderStatus } from '@theolive/types';

import { signInWithEmail } from './auth';
import type { TypedSupabaseClient } from './client';
import { userTopic } from './orderChannels';
import { cancelMyOrder, fetchOrder } from './orders';
import {
  confirmPayment,
  createCheckout,
  runTestPayment,
  type CheckoutInput,
  type CheckoutLineInput,
  type CheckoutResult,
} from './payments';
import {
  fetchCheckoutQuote,
  fetchExchangeOptions,
  fetchMyCoupons,
  fetchStampBalance,
  fetchStampLedger,
  redeemStamps,
} from './rewards';
import {
  fetchCouponRules,
  fetchIssuedCoupons,
  fetchStampOverview,
  fetchStampPolicy,
  saveCouponRule,
  setCouponRuleActive,
  setStampPolicy,
} from './rewardsAdmin';
import { transitionOrder } from './staffOrders';

// Runs against the LOCAL Supabase stack with `supabase functions serve --env-file supabase/functions/.env` running
// (same env as orders.integration.test.ts). TEST PAYMENT GATEWAY ONLY. Each run signs up its own customer and its
// own exchange rule, so it needs no database reset and leaves the seed customers alone.
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const AMERICANO_PRICE = 4500;

function anonymousClient(): TypedSupabaseClient {
  if (!url || !anonKey) throw new Error('integration env missing');
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

function serviceClient(): TypedSupabaseClient {
  if (!url || !serviceKey) throw new Error('service key missing');
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}

async function signedIn(email: string, password = SEED_PASSWORD) {
  const client = anonymousClient();
  await signInWithEmail(client, { email, password });
  return client;
}

/** A brand-new customer: no stamps, no coupons. */
async function newCustomer() {
  const email = `rewards-${randomUUID()}@theolive.local`;
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { nickname: '리워드테스트' },
  });
  if (error) throw error;
  return { id: data.user.id, client: await signedIn(email) };
}

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    clientRequestId: randomUUID(),
    orderType: 'TAKEOUT',
    lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 1 }],
    userCouponId: null,
    pointsToUse: 0,
    paymentMethod: 'CARD',
    note: null,
    ...overrides,
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

async function payOrder(customer: TypedSupabaseClient, overrides: Partial<CheckoutInput> = {}) {
  const checkout = await createCheckout(customer, input(overrides));
  await settle(customer, checkout);
  return checkout;
}

const FLOW: {
  action: 'ACCEPT' | 'START_PREPARING' | 'MARK_READY' | 'COMPLETE';
  from: OrderStatus;
}[] = [
  { action: 'ACCEPT', from: 'PAID' },
  { action: 'START_PREPARING', from: 'ACCEPTED' },
  { action: 'MARK_READY', from: 'PREPARING' },
  { action: 'COMPLETE', from: 'READY' },
];

async function complete(staff: TypedSupabaseClient, orderId: string, upTo = 4) {
  for (const step of FLOW.slice(0, upTo)) {
    await transitionOrder(staff, { orderId, action: step.action, expectedStatus: step.from });
  }
}

async function expectAppError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe.skipIf(!url || !anonKey || !serviceKey)(
  'Olive Stamps and reward coupons against local Supabase (TEST PG)',
  () => {
    it('earns one stamp per COMPLETED order only, exchanges once, applies the coupon on the server and restores it on refund', async () => {
      const { id: userId, client: customer } = await newCustomer();
      const other = await newCustomer();
      const barista = await signedIn('barista@theolive.local');
      const admin = await signedIn('admin@theolive.local');

      // Admin: the policy is fixed (no timing), and a rule of this run costs 2 stamps.
      expect(await fetchStampPolicy(admin)).toMatchObject({ earnMode: expect.any(String) });
      await expectAppError(
        setStampPolicy(customer, { earnMode: 'PER_ORDER', stampsPerOrder: 1 }),
        'FORBIDDEN',
      );
      const title = `통합테스트 ${randomUUID().slice(0, 8)}`;
      // A customer's insert is stopped by row-level security (a database error, not an app code).
      await expectAppError(
        saveCouponRule(customer, {
          id: null,
          title,
          requiredStamps: 2,
          validDays: 30,
          benefitType: 'FREE_ITEM',
          discountAmount: null,
        }),
        'INTERNAL',
      );
      await saveCouponRule(admin, {
        id: null,
        title,
        requiredStamps: 2,
        validDays: 30,
        benefitType: 'FREE_ITEM',
        discountAmount: null,
      });
      const rule = (await fetchCouponRules(admin)).find((r) => r.title === title);
      if (!rule) throw new Error('rule missing');
      expect((await fetchExchangeOptions(customer)).some((o) => o.id === rule.id)).toBe(true);

      // Listens for the realtime hint on the member's own topic.
      const events: string[] = [];
      const channel = customer.channel(userTopic(userId), { config: { private: true } });
      channel.on('broadcast', { event: 'reward_updated' }, (message) => {
        events.push(String((message.payload as { asset?: string }).asset));
      });
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status !== ('SUBSCRIBING' as string)) resolve();
        });
      });

      // Not on PAID, ACCEPTED or READY; yes on COMPLETED; the duplicate completion changes nothing.
      const first = await payOrder(customer);
      expect(await fetchStampBalance(customer, userId)).toBe(0);
      await complete(barista, first.orderId, 3);
      expect(await fetchStampBalance(customer, userId)).toBe(0);
      await transitionOrder(barista, {
        orderId: first.orderId,
        action: 'COMPLETE',
        expectedStatus: 'READY',
      });
      expect(await fetchStampBalance(customer, userId)).toBe(1);
      const repeat = await transitionOrder(barista, {
        orderId: first.orderId,
        action: 'COMPLETE',
        expectedStatus: 'COMPLETED',
      });
      expect(repeat.isReplay).toBe(true);
      expect(await fetchStampBalance(customer, userId)).toBe(1);
      const ledger = await fetchStampLedger(customer, userId);
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        kind: 'EARN',
        delta: 1,
        label: '주문 적립',
        orderId: first.orderId,
      });
      // Nobody else sees this ledger.
      expect(await fetchStampLedger(other.client, userId)).toEqual([]);
      expect(await fetchStampBalance(other.client, userId)).toBe(0);

      // A rejected order earns nothing.
      const rejected = await payOrder(customer);
      await transitionOrder(barista, {
        orderId: rejected.orderId,
        action: 'REJECT',
        expectedStatus: 'PAID',
        reasonCode: 'SOLD_OUT',
      });
      expect(await fetchStampBalance(customer, userId)).toBe(1);

      // Exchange: 1 stamp is not enough for a 2-stamp rule.
      await expectAppError(
        redeemStamps(customer, { couponId: rule.id, clientRequestId: randomUUID() }),
        'INSUFFICIENT_STAMPS',
      );
      const second = await payOrder(customer);
      await complete(barista, second.orderId);
      expect(await fetchStampBalance(customer, userId)).toBe(2);

      // Concurrent double exchange with two request ids: only one fits the balance.
      const results = await Promise.allSettled([
        redeemStamps(customer, { couponId: rule.id, clientRequestId: randomUUID() }),
        redeemStamps(customer, { couponId: rule.id, clientRequestId: randomUUID() }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejectedExchange = results.find((r) => r.status === 'rejected');
      expect(rejectedExchange?.status === 'rejected' && rejectedExchange.reason).toMatchObject({
        code: 'INSUFFICIENT_STAMPS',
      });
      expect(await fetchStampBalance(customer, userId)).toBe(0);
      let wallet = await fetchMyCoupons(customer, userId);
      expect(wallet).toHaveLength(1);
      expect(wallet[0]).toMatchObject({ title, status: 'AVAILABLE', benefitType: 'FREE_ITEM' });
      const couponId = wallet[0]?.id ?? '';

      // The same request id, even in parallel, is one coupon.
      const sameKey = randomUUID();
      const earned = await payOrder(customer);
      await complete(barista, earned.orderId);
      await payOrder(customer).then((o) => complete(barista, o.orderId));
      const pair = await Promise.all([
        redeemStamps(customer, { couponId: rule.id, clientRequestId: sameKey }),
        redeemStamps(customer, { couponId: rule.id, clientRequestId: sameKey }),
      ]);
      expect(pair[0].userCouponId).toBe(pair[1].userCouponId);
      expect(pair.filter((r) => r.isReplay)).toHaveLength(1);
      expect(await fetchStampBalance(customer, userId)).toBe(0);
      wallet = await fetchMyCoupons(customer, userId);
      expect(wallet).toHaveLength(2);
      const spareCouponId = wallet.find((c) => c.id !== couponId)?.id ?? '';

      // Other users' coupons and unknown coupons are not usable; the quote shows the server discount.
      await expectAppError(
        createCheckout(other.client, input({ userCouponId: couponId })),
        'COUPON_NOT_USABLE',
      );
      const lines: CheckoutLineInput[] = [
        { menuItemId: AMERICANO, temperature: 'HOT', quantity: 2 },
      ];
      const quote = await fetchCheckoutQuote(customer, lines, couponId);
      expect(quote).toMatchObject({
        menuAmount: 2 * AMERICANO_PRICE,
        couponDiscount: AMERICANO_PRICE,
        paidAmount: AMERICANO_PRICE,
      });
      expect(quote.usableCouponIds).toEqual(expect.arrayContaining([couponId, spareCouponId]));

      // One coupon used by two parallel checkouts: exactly one wins.
      const race = await Promise.allSettled([
        createCheckout(customer, input({ lines, userCouponId: couponId })),
        createCheckout(customer, input({ lines, userCouponId: couponId })),
      ]);
      const winners = race.filter((r) => r.status === 'fulfilled');
      expect(winners).toHaveLength(1);
      const loser = race.find((r) => r.status === 'rejected');
      expect(loser?.status === 'rejected' && loser.reason).toMatchObject({
        code: 'COUPON_NOT_USABLE',
      });
      const winner = winners[0];
      if (winner?.status !== 'fulfilled') throw new Error('no winner');
      // The response carries the server discount and a discounted amount; the provider is asked for that amount.
      expect(winner.value).toMatchObject({
        menuAmount: 2 * AMERICANO_PRICE,
        couponDiscount: AMERICANO_PRICE,
        amount: AMERICANO_PRICE,
      });
      expect((await fetchMyCoupons(customer, userId)).find((c) => c.id === couponId)?.status).toBe(
        'AVAILABLE',
      );
      await settle(customer, winner.value);
      expect(await fetchOrder(customer, winner.value.orderId)).toMatchObject({
        paidAmount: AMERICANO_PRICE,
        couponDiscount: AMERICANO_PRICE,
        couponTitle: title,
        status: 'PAID',
      });
      expect((await fetchMyCoupons(customer, userId)).find((c) => c.id === couponId)?.status).toBe(
        'USED',
      );
      // The board shows the applied coupon title to staff, not the member's wallet.
      await expectAppError(
        createCheckout(customer, input({ lines, userCouponId: couponId })),
        'COUPON_NOT_USABLE',
      );

      // Refund after a reject restores the coupon.
      await transitionOrder(barista, {
        orderId: winner.value.orderId,
        action: 'REJECT',
        expectedStatus: 'PAID',
        reasonCode: 'TOO_BUSY',
      });
      expect(await fetchOrder(customer, winner.value.orderId)).toMatchObject({
        paymentStatus: 'REFUNDED',
      });
      expect((await fetchMyCoupons(customer, userId)).find((c) => c.id === couponId)?.status).toBe(
        'AVAILABLE',
      );

      // A coupon held by an abandoned checkout is released when the customer cancels it.
      const abandoned = await createCheckout(
        customer,
        input({ lines, userCouponId: spareCouponId }),
      );
      expect(
        (await fetchMyCoupons(customer, userId)).find((c) => c.id === spareCouponId)?.status,
      ).toBe('AVAILABLE');
      await cancelMyOrder(customer, {
        orderId: abandoned.orderId,
        expectedStatus: 'PENDING_PAYMENT',
      });
      await createCheckout(customer, input({ lines, userCouponId: spareCouponId }));

      // A coupon that covers the whole order needs no provider and is used at once.
      const free = await createCheckout(
        customer,
        input({
          userCouponId: couponId,
          lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 1 }],
        }),
      );
      expect(free).toMatchObject({ amount: 0, couponDiscount: AMERICANO_PRICE, status: 'PAID' });
      expect(free.nextAction.type).toBe('NONE');
      expect((await fetchMyCoupons(customer, userId)).find((c) => c.id === couponId)?.status).toBe(
        'USED',
      );
      // Completing it earns a stamp even though nothing was charged (OQ-23).
      await complete(barista, free.orderId);
      expect(await fetchStampBalance(customer, userId)).toBe(1);

      // Admin sees the issued coupons and the overview; the realtime hints arrived.
      expect(
        (await fetchIssuedCoupons(admin)).filter((c) => c.title === title).length,
      ).toBeGreaterThanOrEqual(2);
      expect((await fetchStampOverview(admin)).outstandingStamps).toBeGreaterThanOrEqual(1);
      await expectAppError(fetchStampOverview(customer), 'FORBIDDEN');
      for (let i = 0; i < 40 && !(events.includes('STAMP') && events.includes('COUPON')); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(events).toEqual(expect.arrayContaining(['STAMP', 'COUPON']));
      await customer.removeChannel(channel);

      // Deactivated rules stop being offered; cleanup of this run's rule.
      await setCouponRuleActive(admin, rule.id, false);
      expect((await fetchExchangeOptions(customer)).some((o) => o.id === rule.id)).toBe(false);
      await expectAppError(
        redeemStamps(customer, { couponId: rule.id, clientRequestId: randomUUID() }),
        'REWARD_INACTIVE',
      );
    }, 120_000);
  },
);
