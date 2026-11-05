import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  TEST_PG_SCENARIO,
  type Database,
  type OrderStatus,
  type TestPgScenario,
} from '@theolive/types';

import { signInWithEmail } from './auth';
import { setMenuItemSoldOut, setStoreStatus } from './catalogMutations';
import type { TypedSupabaseClient } from './client';
import {
  confirmPayment,
  createCheckout,
  fetchPaymentStatus,
  runTestPayment,
  type CheckoutInput,
} from './payments';
import { cancelMyOrder, fetchMyOrders, fetchOrder } from './orders';
import { userTopic } from './orderChannels';
import { adminCancelOrder, fetchBoardOrders, transitionOrder } from './staffOrders';

// Runs against the LOCAL Supabase stack with `supabase functions serve --env-file supabase/functions/.env` running.
// TEST PAYMENT GATEWAY ONLY: nothing here moves real money.
//   SUPABASE_INTEGRATION_URL=http://127.0.0.1:54321 SUPABASE_INTEGRATION_ANON_KEY=<publishable key> \
//   SUPABASE_INTEGRATION_SERVICE_KEY=<service role key> pnpm --filter @theolive/api test
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? 'local-test-webhook-secret-change-me';
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const VANILLA_LATTE_SOLD_OUT = '00000000-0000-4000-8000-000000000204';
const LATTE = '00000000-0000-4000-8000-000000000203';
const CUSTOMER1 = '00000000-0000-4000-8000-0000000000c1';
const CUSTOMER2 = '00000000-0000-4000-8000-0000000000c2';
const FUNCTIONS_URL = `${url}/functions/v1`;
const OVERDUE_MARGIN_MS = 24 * 60 * 60 * 1000;

function anonymousClient(): TypedSupabaseClient {
  if (!url || !anonKey) throw new Error('integration env missing');
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

async function signedIn(email: string): Promise<TypedSupabaseClient> {
  const client = anonymousClient();
  await signInWithEmail(client, { email, password: SEED_PASSWORD });
  return client;
}

function serviceClient(): TypedSupabaseClient {
  if (!url || !serviceKey) throw new Error('service key missing');
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}

function checkoutInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    clientRequestId: randomUUID(),
    orderType: 'TAKEOUT',
    lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 2 }],
    userCouponId: null,
    pointsToUse: 0,
    paymentMethod: 'CARD',
    note: null,
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

/** Subscribes to a private topic and collects the events; resolves once SUBSCRIBED (or reports the failure). */
async function listen(client: TypedSupabaseClient, topic: string, events: string[]) {
  const received: { event: string; orderId: string; status: string }[] = [];
  let state = 'connecting';
  const channel = client.channel(topic, { config: { private: true } });
  for (const event of events) {
    channel.on('broadcast', { event }, (message) => {
      const payload = message.payload as { orderId?: string; status?: string };
      received.push({ event, orderId: String(payload.orderId), status: String(payload.status) });
    });
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5000);
    channel.subscribe((status) => {
      state = status;
      if (status !== ('SUBSCRIBING' as string)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return {
    received,
    state: () => state,
    close: () => client.removeChannel(channel),
    waitFor: async (predicate: (item: (typeof received)[number]) => boolean) => {
      for (let i = 0; i < 60; i += 1) {
        if (received.some(predicate)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    },
  };
}

/** Pays an order through the TEST sheet and confirms it, like the app does. */
async function payWithTestSheet(
  customer: TypedSupabaseClient,
  scenario: TestPgScenario = TEST_PG_SCENARIO.SUCCESS,
  overrides: Partial<CheckoutInput> = {},
) {
  const checkout = await createCheckout(customer, checkoutInput(overrides));
  if (checkout.nextAction.type !== 'TEST_SHEET') throw new Error('expected a test sheet');
  const decision = await runTestPayment(customer, {
    checkoutToken: checkout.nextAction.checkoutToken,
    scenario,
  });
  return { checkout, decision };
}

async function pay(customer: TypedSupabaseClient, overrides: Partial<CheckoutInput> = {}) {
  const { checkout, decision } = await payWithTestSheet(customer, 'SUCCESS', overrides);
  if (!decision.providerPaymentKey) throw new Error('no key');
  const confirmed = await confirmPayment(customer, {
    paymentId: checkout.paymentId,
    providerPaymentKey: decision.providerPaymentKey,
  });
  return { checkout, confirmed };
}

async function statusOf(customer: TypedSupabaseClient, orderId: string) {
  return await fetchPaymentStatus(customer, { orderId });
}

describe.skipIf(!url || !anonKey || !serviceKey)(
  'orders and payments against local Supabase (TEST PG)',
  () => {
    it('end to end: pay with the test PG, staff accept → preparing → ready → complete, customers see each status', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const other = await signedIn('customer2@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const staffListener = await listen(barista, 'store:orders', ['order_paid', 'order_updated']);
      const customerListener = await listen(customer, userTopic(CUSTOMER1), ['order_updated']);
      const otherListener = await listen(other, userTopic(CUSTOMER2), ['order_updated']);
      // Another customer cannot even subscribe to this customer's topic, nor to the board.
      const snoop = await listen(other, userTopic(CUSTOMER1), ['order_updated']);
      const snoopBoard = await listen(other, 'store:orders', ['order_paid', 'order_updated']);
      expect(staffListener.state()).toBe('SUBSCRIBED');
      expect(customerListener.state()).toBe('SUBSCRIBED');
      expect(snoop.state()).not.toBe('SUBSCRIBED');
      expect(snoopBoard.state()).not.toBe('SUBSCRIBED');

      const checkout = await createCheckout(customer, checkoutInput());
      // 2 x 아메리카노 at the server's price; the request carried no prices.
      expect(checkout).toMatchObject({
        amount: 9000,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'READY',
        isReplay: false,
      });
      expect(checkout.nextAction.type).toBe('TEST_SHEET');
      // An unpaid checkout is invisible to the board.
      expect((await fetchBoardOrders(barista)).some((o) => o.id === checkout.orderId)).toBe(false);

      if (checkout.nextAction.type !== 'TEST_SHEET') throw new Error('sheet expected');
      const decision = await runTestPayment(customer, {
        checkoutToken: checkout.nextAction.checkoutToken,
        scenario: 'SUCCESS',
      });
      expect(decision.result).toBe('APPROVED');
      // The sheet's own result is not proof: the order is still unpaid until the server verifies it.
      expect((await fetchOrder(customer, checkout.orderId))?.status).toBe('PENDING_PAYMENT');

      const confirmed = await confirmPayment(customer, {
        paymentId: checkout.paymentId,
        providerPaymentKey: decision.providerPaymentKey ?? '',
      });
      expect(confirmed).toMatchObject({ orderStatus: 'PAID', paymentStatus: 'PAID' });
      expect(confirmed.orderNumber).toMatch(/^A-\d+$/);
      // Confirming again is a no-op with the same answer.
      expect(
        await confirmPayment(customer, {
          paymentId: checkout.paymentId,
          providerPaymentKey: decision.providerPaymentKey ?? '',
        }),
      ).toMatchObject({ orderStatus: 'PAID', orderNumber: confirmed.orderNumber });

      expect(
        await staffListener.waitFor(
          (e) => e.orderId === checkout.orderId && e.event === 'order_paid',
        ),
      ).toBe(true);
      const board = await fetchBoardOrders(barista);
      expect(board.find((o) => o.id === checkout.orderId)).toMatchObject({
        status: 'PAID',
        orderNumber: confirmed.orderNumber,
        paidAmount: 9000,
      });

      const steps: [Parameters<typeof transitionOrder>[1]['action'], OrderStatus, OrderStatus][] = [
        ['ACCEPT', 'PAID', 'ACCEPTED'],
        ['START_PREPARING', 'ACCEPTED', 'PREPARING'],
        ['MARK_READY', 'PREPARING', 'READY'],
        ['COMPLETE', 'READY', 'COMPLETED'],
      ];
      for (const [action, expectedStatus, next] of steps) {
        expect(
          await transitionOrder(barista, { orderId: checkout.orderId, action, expectedStatus }),
        ).toEqual({ status: next, isReplay: false });
        expect(
          await customerListener.waitFor(
            (e) => e.orderId === checkout.orderId && e.status === next,
          ),
        ).toBe(true);
        expect((await fetchOrder(customer, checkout.orderId))?.status).toBe(next);
      }
      // A repeated tap is a replay, a stale tablet gets STALE_STATUS.
      expect(
        await transitionOrder(barista, {
          orderId: checkout.orderId,
          action: 'COMPLETE',
          expectedStatus: 'READY',
        }),
      ).toEqual({ status: 'COMPLETED', isReplay: true });
      await expectAppError(
        transitionOrder(barista, {
          orderId: checkout.orderId,
          action: 'ACCEPT',
          expectedStatus: 'PAID',
        }),
        'STALE_STATUS',
      );

      // The owning customer sees it in history; the other customer's topic stayed silent.
      expect((await fetchMyOrders(customer)).some((o) => o.id === checkout.orderId)).toBe(true);
      expect(await fetchOrder(other, checkout.orderId)).toBeNull();
      expect(otherListener.received.filter((e) => e.orderId === checkout.orderId)).toEqual([]);
      expect(snoop.received).toEqual([]);
      for (const listener of [staffListener, customerListener, otherListener, snoop, snoopBoard]) {
        await listener.close();
      }
    }, 60_000);

    it('double tap: parallel checkouts with the same key create one order; a changed body conflicts; extra price fields are rejected', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const input = checkoutInput();
      const [a, b] = await Promise.all([
        createCheckout(customer, input),
        createCheckout(customer, input),
      ]);
      expect(a.orderId).toBe(b.orderId);
      expect(a.paymentId).toBe(b.paymentId);
      expect([a.isReplay, b.isReplay].sort()).toEqual([false, true]);
      const { count } = await serviceClient()
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('client_request_id', input.clientRequestId);
      expect(count).toBe(1);
      await expectAppError(
        createCheckout(customer, {
          ...input,
          lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 5 }],
        }),
        'IDEMPOTENCY_CONFLICT',
      );
      // Prices are never read from the client: a request that carries one is refused outright.
      const { error } = await customer.functions.invoke('payments-checkout', {
        body: {
          ...input,
          clientRequestId: randomUUID(),
          lines: [{ menuItemId: AMERICANO, temperature: 'HOT', quantity: 1, unitPrice: 1 }],
        },
      });
      expect(error).not.toBeNull();
      // Cancel the leftover orders so they do not linger as unpaid checkouts.
      await cancelMyOrder(customer, { orderId: a.orderId, expectedStatus: 'PENDING_PAYMENT' });
    }, 30_000);

    it('rejects closed stores, paused ordering, sold-out items and signed-out callers', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const staff = await signedIn('staff@theolive.local');
      await setStoreStatus(staff, { isAcceptingOrders: false });
      await expectAppError(createCheckout(customer, checkoutInput()), 'NOT_ACCEPTING_ORDERS');
      await setStoreStatus(staff, { isOpen: false, isAcceptingOrders: true });
      await expectAppError(createCheckout(customer, checkoutInput()), 'STORE_CLOSED');
      await setStoreStatus(staff, { isOpen: true });
      await expectAppError(
        createCheckout(
          customer,
          checkoutInput({
            lines: [{ menuItemId: VANILLA_LATTE_SOLD_OUT, temperature: 'HOT', quantity: 1 }],
          }),
        ),
        'ITEM_SOLD_OUT',
      );
      await setMenuItemSoldOut(staff, LATTE, true);
      await expectAppError(
        createCheckout(
          customer,
          checkoutInput({ lines: [{ menuItemId: LATTE, temperature: 'HOT', quantity: 1 }] }),
        ),
        'ITEM_SOLD_OUT',
      );
      await setMenuItemSoldOut(staff, LATTE, false);
      await expectAppError(
        createCheckout(
          customer,
          checkoutInput({ lines: [{ menuItemId: randomUUID(), temperature: 'HOT', quantity: 1 }] }),
        ),
        'ITEM_UNAVAILABLE',
      );
      const { error } = await anonymousClient().functions.invoke('payments-checkout', {
        body: checkoutInput(),
      });
      expect(error).not.toBeNull();
    }, 30_000);

    it('failed and cancelled payments cancel the order; success via webhook only is recovered through payments-status', async () => {
      const customer = await signedIn('customer1@theolive.local');
      for (const [scenario, payment] of [
        ['FAIL', 'FAILED'],
        ['CANCEL', 'CANCELLED'],
      ] as const) {
        const { checkout, decision } = await payWithTestSheet(customer, scenario);
        expect(decision.result).toBe(scenario === 'FAIL' ? 'FAILED' : 'CANCELLED');
        expect(await statusOf(customer, checkout.orderId)).toMatchObject({
          orderStatus: 'CANCELLED',
          paymentStatus: payment,
        });
        // A confirm with the (absent) key cannot revive it.
        await expectAppError(
          confirmPayment(customer, { paymentId: checkout.paymentId, providerPaymentKey: 'nope' }),
          'PAYMENT_NOT_APPROVED',
        );
      }
      // App killed after approval: only the webhook reports it; the app's next status call shows PAID.
      const { checkout, decision } = await payWithTestSheet(customer, 'SUCCESS_WEBHOOK_ONLY');
      expect(decision.providerPaymentKey).toBeNull();
      expect(await statusOf(customer, checkout.orderId)).toMatchObject({
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
      });
    }, 40_000);

    it('recovers an approved payment nobody reported (lost webhook, killed app) through payments-status after 30 s', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const { checkout, decision } = await payWithTestSheet(customer, 'SUCCESS');
      expect(decision.result).toBe('APPROVED');
      // Approved at the provider, but neither confirm nor webhook ever arrived.
      expect(await statusOf(customer, checkout.orderId)).toMatchObject({
        orderStatus: 'PENDING_PAYMENT',
        paymentStatus: 'READY',
      });
      const past = new Date(Date.now() - 60_000).toISOString();
      await serviceClient()
        .from('payments')
        .update({ requested_at: past })
        .eq('id', checkout.paymentId);
      expect(await statusOf(customer, checkout.orderId)).toMatchObject({
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
      });
    }, 30_000);

    it('duplicate webhooks and a racing confirm apply exactly once', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const { checkout, decision } = await payWithTestSheet(customer, 'SUCCESS_DUPLICATE_WEBHOOK');
      const key = decision.providerPaymentKey ?? '';
      const results = await Promise.all([
        confirmPayment(customer, { paymentId: checkout.paymentId, providerPaymentKey: key }),
        confirmPayment(customer, { paymentId: checkout.paymentId, providerPaymentKey: key }),
      ]);
      expect(results[0].orderNumber).toBe(results[1].orderNumber);
      expect(results[0].orderStatus).toBe('PAID');
      const service = serviceClient();
      const { data: events } = await service
        .from('payment_events')
        .select('result, source')
        .eq('payment_id', checkout.paymentId);
      expect(events?.filter((e) => e.result === 'APPLIED')).toHaveLength(1);
      const { data: history } = await service
        .from('order_status_history')
        .select('to_status')
        .eq('order_id', checkout.orderId)
        .order('id');
      expect(history?.map((h) => h.to_status)).toEqual(['PENDING_PAYMENT', 'PAID']);
    }, 30_000);

    it('late approval after expiry is refunded automatically and the order stays cancelled; amount mismatch fails and cancels', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const late = await payWithTestSheet(customer, 'SUCCESS_LATE');
      expect(await statusOf(customer, late.checkout.orderId)).toMatchObject({
        orderStatus: 'CANCELLED',
        paymentStatus: 'REFUNDED',
      });
      await expectAppError(
        confirmPayment(customer, {
          paymentId: late.checkout.paymentId,
          providerPaymentKey: late.decision.providerPaymentKey ?? '',
        }),
        'PAYMENT_EXPIRED',
      );
      const { data: refund } = await serviceClient()
        .from('refunds')
        .select('status, amount, reason')
        .eq('payment_id', late.checkout.paymentId);
      expect(refund).toEqual([
        { status: 'SUCCEEDED', amount: late.checkout.amount, reason: 'LATE_APPROVAL' },
      ]);

      const mismatch = await payWithTestSheet(customer, 'AMOUNT_MISMATCH');
      await expectAppError(
        confirmPayment(customer, {
          paymentId: mismatch.checkout.paymentId,
          providerPaymentKey: mismatch.decision.providerPaymentKey ?? '',
        }),
        'PAYMENT_AMOUNT_MISMATCH',
      );
      expect(await statusOf(customer, mismatch.checkout.orderId)).toMatchObject({
        orderStatus: 'CANCELLED',
        paymentStatus: 'FAILED',
      });
    }, 40_000);

    it('reject refunds the customer; customer cancel works only while PAID; admin cancels an accepted order; barista cannot', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const admin = await signedIn('admin@theolive.local');

      const rejected = await pay(customer);
      await expectAppError(
        transitionOrder(barista, {
          orderId: rejected.checkout.orderId,
          action: 'REJECT',
          expectedStatus: 'PAID',
        }),
        'REASON_REQUIRED',
      );
      await transitionOrder(barista, {
        orderId: rejected.checkout.orderId,
        action: 'REJECT',
        expectedStatus: 'PAID',
        reasonCode: 'SOLD_OUT',
      });
      expect(await fetchOrder(customer, rejected.checkout.orderId)).toMatchObject({
        status: 'REJECTED',
        paymentStatus: 'REFUNDED',
        rejectReasonCode: 'SOLD_OUT',
      });

      const cancelled = await pay(customer);
      await cancelMyOrder(customer, {
        orderId: cancelled.checkout.orderId,
        expectedStatus: 'PAID',
      });
      expect(await fetchOrder(customer, cancelled.checkout.orderId)).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
      });

      const accepted = await pay(customer);
      await transitionOrder(barista, {
        orderId: accepted.checkout.orderId,
        action: 'ACCEPT',
        expectedStatus: 'PAID',
      });
      await expectAppError(
        cancelMyOrder(customer, { orderId: accepted.checkout.orderId, expectedStatus: 'ACCEPTED' }),
        'INVALID_TRANSITION',
      );
      await expectAppError(
        adminCancelOrder(barista, {
          orderId: accepted.checkout.orderId,
          expectedStatus: 'ACCEPTED',
          reason: '테스트',
        }),
        'FORBIDDEN',
      );
      await adminCancelOrder(admin, {
        orderId: accepted.checkout.orderId,
        expectedStatus: 'ACCEPTED',
        reason: '고객 요청',
      });
      expect(await fetchOrder(customer, accepted.checkout.orderId)).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        cancelReason: '고객 요청',
      });
    }, 60_000);

    it('a refund the provider fails stays PAID/REQUESTED and the reconcile job completes it', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const service = serviceClient();
      const paid = await pay(customer);
      await service.rpc('test_pg_set', {
        p_payment_id: paid.checkout.paymentId,
        p_status: 'APPROVED',
        p_refund_failures: 1,
      });
      await transitionOrder(barista, {
        orderId: paid.checkout.orderId,
        action: 'REJECT',
        expectedStatus: 'PAID',
        reasonCode: 'TOO_BUSY',
      });
      expect(await fetchOrder(customer, paid.checkout.orderId)).toMatchObject({
        status: 'REJECTED',
        paymentStatus: 'PAID',
      });
      const { data: failed } = await service
        .from('refunds')
        .select('status')
        .eq('payment_id', paid.checkout.paymentId);
      expect(failed).toEqual([{ status: 'FAILED' }]);

      // Reconcile is for the service role only.
      const denied = await fetch(`${FUNCTIONS_URL}/payments-reconcile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await customer.auth.getSession()).data.session?.access_token}`,
        },
      });
      expect(denied.status).toBe(403);
      const response = await fetch(`${FUNCTIONS_URL}/payments-reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { refundsRetried: number }).refundsRetried,
      ).toBeGreaterThanOrEqual(1);
      expect(await fetchOrder(customer, paid.checkout.orderId)).toMatchObject({
        status: 'REJECTED',
        paymentStatus: 'REFUNDED',
      });
    }, 60_000);

    it('reconcile expires overdue unpaid orders', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const checkout = await createCheckout(customer, checkoutInput());
      // The database decides "overdue" with its own clock (now()), which can differ from this machine's (Docker
      // clocks drift, e.g. after sleep). A margin of one second made the order "not overdue yet" whenever the
      // database clock lagged, so the margin is a full day.
      const { error: expireError } = await serviceClient()
        .from('orders')
        .update({ expires_at: new Date(Date.now() - OVERDUE_MARGIN_MS).toISOString() })
        .eq('id', checkout.orderId);
      expect(expireError).toBeNull();
      const response = await fetch(`${FUNCTIONS_URL}/payments-reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      expect(response.status).toBe(200);
      expect(await fetchOrder(customer, checkout.orderId)).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        cancelReason: 'EXPIRED',
      });
    }, 30_000);

    it('webhook: a bad signature is 401 and changes nothing; a signed event for an unknown payment is acknowledged', async () => {
      const customer = await signedIn('customer1@theolive.local');
      const checkout = await createCheckout(customer, checkoutInput());
      const body = JSON.stringify({
        eventId: `evt-${randomUUID()}`,
        type: 'PAYMENT_APPROVED',
        paymentId: checkout.paymentId,
        providerPaymentId: 'forged',
        amount: checkout.amount,
        failureCode: null,
      });
      const bad = await fetch(`${FUNCTIONS_URL}/payments-webhook`, {
        method: 'POST',
        headers: { 'x-test-pg-signature': 'deadbeef' },
        body,
      });
      expect(bad.status).toBe(401);
      const missing = await fetch(`${FUNCTIONS_URL}/payments-webhook`, { method: 'POST', body });
      expect(missing.status).toBe(401);
      expect((await fetchOrder(customer, checkout.orderId))?.status).toBe('PENDING_PAYMENT');

      const unknown = JSON.stringify({ ...JSON.parse(body), paymentId: randomUUID() });
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(unknown).digest('hex');
      const ok = await fetch(`${FUNCTIONS_URL}/payments-webhook`, {
        method: 'POST',
        headers: { 'x-test-pg-signature': signature },
        body: unknown,
      });
      expect(ok.status).toBe(200);
      await cancelMyOrder(customer, {
        orderId: checkout.orderId,
        expectedStatus: 'PENDING_PAYMENT',
      });
    }, 30_000);

    it('a zero-amount order is paid at once with no provider step (OQ-18)', async () => {
      const service = serviceClient();
      const customer = await signedIn('customer1@theolive.local');
      const { data: item } = await service
        .from('menu_items')
        .insert({
          category_id: '00000000-0000-4000-8000-000000000105',
          name: '무료 시식(테스트)',
          price: 0,
          temperatures: [],
        })
        .select('id')
        .single();
      const checkout = await createCheckout(
        customer,
        checkoutInput({ lines: [{ menuItemId: item?.id ?? '', temperature: null, quantity: 1 }] }),
      );
      expect(checkout).toMatchObject({ amount: 0, status: 'PAID', paymentStatus: 'PAID' });
      expect(checkout.nextAction.type).toBe('NONE');
      expect(checkout.orderNumber).toMatch(/^A-\d+$/);
      await service
        .from('menu_items')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', item?.id ?? '');
    }, 30_000);
  },
);
