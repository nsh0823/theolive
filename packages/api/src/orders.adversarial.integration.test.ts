import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@theolive/types';

import { signInWithEmail } from './auth';
import type { TypedSupabaseClient } from './client';

// QA adversarial suite for the order + payment backend. LOCAL stack only, TEST payment gateway only.
// Same environment as orders.integration.test.ts (functions served with supabase/functions/.env).
// Tests named "DEFECT:" reproduce a confirmed defect and are expected to FAIL until it is fixed.
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? 'local-test-webhook-secret-change-me';
const PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const SOLD_OUT_ITEM = '00000000-0000-4000-8000-000000000204';
const FN = `${url}/functions/v1`;

const anon = () =>
  createClient<Database>(url ?? '', anonKey ?? '', { auth: { persistSession: false } });
const service = () =>
  createClient<Database>(url ?? '', serviceKey ?? '', { auth: { persistSession: false } });
async function login(email: string) {
  const client = anon();
  await signInWithEmail(client, { email, password: PASSWORD });
  const { data } = await client.auth.getSession();
  return { client, jwt: data.session?.access_token ?? '' };
}

type Reply = { status: number; body: Record<string, unknown> & { error?: { code?: string } } };
async function callFn(
  name: string,
  jwt: string | null,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Reply> {
  const response = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey ?? '',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Reply['body'] = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}
async function rest(
  path: string,
  jwt: string | null,
  init: RequestInit & { profile?: string } = {},
) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey ?? '',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(init.profile ? { 'Accept-Profile': init.profile, 'Content-Profile': init.profile } : {}),
    },
    body: init.body,
  });
  return { status: response.status, text: await response.text() };
}
const sign = (raw: string) => createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
async function webhook(
  event: {
    eventId: string;
    type: string;
    paymentId: string;
    providerPaymentId: string | null;
    amount: number | null;
    failureCode?: string | null;
  },
  signature?: string,
) {
  const raw = JSON.stringify({ failureCode: null, ...event });
  const response = await fetch(`${FN}/payments-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-pg-signature': signature ?? sign(raw) },
    body: raw,
  });
  return response.status;
}
const line = (quantity: unknown, over: Record<string, unknown> = {}) => ({
  menuItemId: AMERICANO,
  temperature: 'HOT',
  quantity,
  ...over,
});
const checkoutBody = (over: Record<string, unknown> = {}) => ({
  clientRequestId: randomUUID(),
  orderType: 'TAKEOUT',
  lines: [line(1)],
  userCouponId: null,
  pointsToUse: 0,
  paymentMethod: 'CARD',
  note: null,
  ...over,
});
async function setStore(open: boolean, accepting: boolean) {
  await service()
    .from('store_settings')
    .update({ is_open: open, is_accepting_orders: accepting })
    .eq('id', 1);
}
async function newPaidOrder(jwt: string) {
  const checkout = await callFn('payments-checkout', jwt, checkoutBody());
  expect(checkout.status).toBe(200);
  const next = checkout.body.nextAction as { checkoutToken: string };
  const decision = await callFn('payments-test-pg', jwt, {
    checkoutToken: next.checkoutToken,
    scenario: 'SUCCESS',
  });
  const confirmed = await callFn('payments-confirm', jwt, {
    paymentId: checkout.body.paymentId,
    providerPaymentKey: decision.body.providerPaymentKey,
  });
  expect(confirmed.status).toBe(200);
  return {
    orderId: String(checkout.body.orderId),
    paymentId: String(checkout.body.paymentId),
    key: String(decision.body.providerPaymentKey),
    token: next.checkoutToken,
    amount: Number(checkout.body.amount),
  };
}
const orderRow = async (id: string) =>
  (
    await service()
      .from('orders')
      .select('status, payment_status, paid_at, order_number, cancel_reason')
      .eq('id', id)
      .single()
  ).data;
const refundsOf = async (paymentId: string) =>
  (await service().from('refunds').select('id, amount, status, reason').eq('payment_id', paymentId))
    .data ?? [];
const historyOf = async (orderId: string) =>
  (
    (
      await service()
        .from('order_status_history')
        .select('from_status, to_status')
        .eq('order_id', orderId)
        .order('id')
    ).data ?? []
  ).map((r) => `${r.from_status ?? '-'}>${r.to_status}`);
const reconcile = () => callFn('payments-reconcile', serviceKey ?? '', {});

describe.skipIf(!url || !anonKey || !serviceKey)(
  'QA adversarial: orders and payments (TEST PG)',
  () => {
    it('price tampering: client price/total fields, bad quantities, items, temperatures and carts never create an order', async () => {
      await setStore(true, true);
      const c1 = await login('customer1@theolive.local');
      const cases: [string, Record<string, unknown>][] = [
        ['unitPrice in line', { lines: [line(1, { unitPrice: 1 })] }],
        ['total at top level', { total: 1 }],
        ['qty 0', { lines: [line(0)] }],
        ['qty -1', { lines: [line(-1)] }],
        ['qty 21', { lines: [line(21)] }],
        ['qty huge', { lines: [line(2 ** 40)] }],
        ['qty float', { lines: [line(1.5)] }],
        ['merged qty over 20', { lines: [line(15), line(10)] }],
        ['empty cart', { lines: [] }],
        ['unknown item', { lines: [line(1, { menuItemId: randomUUID() })] }],
        ['sold-out item', { lines: [line(1, { menuItemId: SOLD_OUT_ITEM })] }],
        ['bad temperature', { lines: [line(1, { temperature: 'WARM' })] }],
        ['points beyond the balance', { pointsToUse: 10_000_000 }],
      ];
      for (const [label, over] of cases) {
        const body = checkoutBody(over);
        const reply = await callFn('payments-checkout', c1.jwt, body);
        expect(reply.status, label).toBeGreaterThanOrEqual(400);
        const rows = await service()
          .from('orders')
          .select('id')
          .eq('client_request_id', String(body.clientRequestId));
        expect(rows.data, label).toEqual([]);
      }
      // Same probes straight at the RPC (bypassing the Edge Function validation): price fields are ignored, qty rejected.
      const rpcBad = [0, -1, 21, 2 ** 40, 1.5, 'abc', null];
      for (const quantity of rpcBad) {
        const id = randomUUID();
        const { error } = await c1.client.rpc('create_checkout_order', {
          p_client_request_id: id,
          p_order_type: 'TAKEOUT',
          // @ts-expect-error -- malformed line payload on purpose: the RPC must reject it
          p_lines: [line(quantity)],
          // @ts-expect-error -- null coupon id on purpose: probes the RPC's own null handling
          p_user_coupon_id: null,
          p_points_to_use: 0,
          p_payment_method: 'CARD',
          // @ts-expect-error -- null note on purpose: probes the RPC's own null handling
          p_note: null,
        });
        expect(error, `rpc qty ${String(quantity)}`).not.toBeNull();
        expect(
          (await service().from('orders').select('id').eq('client_request_id', id)).data,
        ).toEqual([]);
      }
      const id = randomUUID();
      const { data } = await c1.client.rpc('create_checkout_order', {
        p_client_request_id: id,
        p_order_type: 'TAKEOUT',
        // @ts-expect-error -- extra price fields on purpose: the RPC must ignore them
        p_lines: [line(1, { unitPrice: 1, price: 1 })],
        // @ts-expect-error -- null coupon id on purpose: probes the RPC's own null handling
        p_user_coupon_id: null,
        p_points_to_use: 0,
        p_payment_method: 'CARD',
        // @ts-expect-error -- null note on purpose: probes the RPC's own null handling
        p_note: null,
      });
      expect((data as { amount: number }).amount).toBe(4500);
      // Archived and hidden items.
      const category =
        (await service().from('menu_items').select('category_id').eq('id', AMERICANO).single()).data
          ?.category_id ?? '';
      const archived = randomUUID();
      const inactive = randomUUID();
      await service()
        .from('menu_items')
        .insert([
          {
            id: archived,
            category_id: category,
            name: 'QA archived',
            price: 1000,
            temperatures: ['HOT'],
            is_active: true,
            archived_at: new Date().toISOString(),
          },
          {
            id: inactive,
            category_id: category,
            name: 'QA hidden',
            price: 1000,
            temperatures: ['HOT'],
            is_active: false,
          },
        ]);
      for (const itemId of [archived, inactive]) {
        const reply = await callFn(
          'payments-checkout',
          c1.jwt,
          checkoutBody({ lines: [line(1, { menuItemId: itemId })] }),
        );
        expect(reply.body.error?.code).toBe('ITEM_UNAVAILABLE');
      }
      await service().from('menu_items').delete().in('id', [archived, inactive]);
      // Closed and paused store.
      await setStore(false, true);
      expect((await callFn('payments-checkout', c1.jwt, checkoutBody())).body.error?.code).toBe(
        'STORE_CLOSED',
      );
      await setStore(true, false);
      expect((await callFn('payments-checkout', c1.jwt, checkoutBody())).body.error?.code).toBe(
        'NOT_ACCEPTING_ORDERS',
      );
      await setStore(true, true);
    });

    it('idempotency: 10 parallel checkouts with one key yield one order; mixed bodies conflict', async () => {
      const c1 = await login('customer1@theolive.local');
      const body = checkoutBody();
      const replies = await Promise.all(
        Array.from({ length: 10 }, () => callFn('payments-checkout', c1.jwt, body)),
      );
      expect(replies.every((r) => r.status === 200)).toBe(true);
      expect(new Set(replies.map((r) => r.body.orderId)).size).toBe(1);
      expect(replies.filter((r) => r.body.isReplay === false)).toHaveLength(1);
      const rows = await service()
        .from('orders')
        .select('id')
        .eq('client_request_id', String(body.clientRequestId));
      expect(rows.data).toHaveLength(1);
      const conflict = await callFn('payments-checkout', c1.jwt, { ...body, note: 'changed' });
      expect(conflict.body.error?.code).toBe('IDEMPOTENCY_CONFLICT');
      // Another customer using the same key gets their own order (key is per customer).
      const c2 = await login('customer2@theolive.local');
      const other = await callFn('payments-checkout', c2.jwt, body);
      expect(other.body.orderId).not.toBe(replies[0]?.body.orderId);
    });

    it('race: confirm x3 + signed webhooks + status at once settle exactly once', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const next = checkout.body.nextAction as { checkoutToken: string };
      const decision = await callFn('payments-test-pg', c1.jwt, {
        checkoutToken: next.checkoutToken,
        scenario: 'SUCCESS',
      });
      const paymentId = String(checkout.body.paymentId);
      const key = String(decision.body.providerPaymentKey);
      const evt = (id: string) => ({
        eventId: id,
        type: 'PAYMENT_APPROVED',
        paymentId,
        providerPaymentId: key,
        amount: 4500,
      });
      await Promise.all([
        ...[1, 2, 3].map(() =>
          callFn('payments-confirm', c1.jwt, { paymentId, providerPaymentKey: key }),
        ),
        webhook(evt(`qa-a-${paymentId}`)),
        webhook(evt(`qa-b-${paymentId}`)),
        webhook(evt(`qa-a-${paymentId}`)),
        callFn('payments-status', c1.jwt, { paymentId }),
      ]);
      const orderId = String(checkout.body.orderId);
      expect(await historyOf(orderId)).toEqual(['->PENDING_PAYMENT', 'PENDING_PAYMENT>PAID']);
      expect((await orderRow(orderId))?.order_number).toMatch(/^A-\d+$/);
      expect(await refundsOf(paymentId)).toEqual([]);
      const events =
        (await service().from('payment_events').select('result').eq('payment_id', paymentId))
          .data ?? [];
      expect(events.filter((e) => e.result === 'APPLIED')).toHaveLength(1);
      // Out-of-order / contradictory events after PAID change nothing.
      expect(
        await webhook({
          ...evt(`qa-fail-${paymentId}`),
          type: 'PAYMENT_FAILED',
          amount: null,
          providerPaymentId: key,
        }),
      ).toBe(200);
      expect(
        await webhook({
          ...evt(`qa-cancel-${paymentId}`),
          type: 'PAYMENT_CANCELLED',
          amount: null,
        }),
      ).toBe(200);
      expect(await webhook({ ...evt(`qa-wrongamt-${paymentId}`), amount: 1 })).toBe(200);
      const after = await orderRow(orderId);
      expect(after?.status).toBe('PAID');
      expect(after?.payment_status).toBe('PAID');
      expect(await refundsOf(paymentId)).toEqual([]);
    });

    it('late approval: racing confirm/webhook/status/reconcile produce exactly one refund of the full amount', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn(
        'payments-checkout',
        c1.jwt,
        checkoutBody({ lines: [line(2)] }),
      );
      const next = checkout.body.nextAction as { checkoutToken: string };
      const decision = await callFn('payments-test-pg', c1.jwt, {
        checkoutToken: next.checkoutToken,
        scenario: 'SUCCESS_LATE',
      });
      const paymentId = String(checkout.body.paymentId);
      const orderId = String(checkout.body.orderId);
      const key = String(decision.body.providerPaymentKey);
      await service()
        .from('payments')
        .update({ requested_at: new Date(Date.now() - 600_000).toISOString() })
        .eq('id', paymentId);
      await Promise.all([
        callFn('payments-confirm', c1.jwt, { paymentId, providerPaymentKey: key }),
        callFn('payments-confirm', c1.jwt, { paymentId, providerPaymentKey: key }),
        webhook({
          eventId: `qa-late-${paymentId}`,
          type: 'PAYMENT_APPROVED',
          paymentId,
          providerPaymentId: key,
          amount: 9000,
        }),
        callFn('payments-status', c1.jwt, { paymentId }),
        callFn('payments-refund', c1.jwt, { orderId }),
        reconcile(),
      ]);
      await callFn('payments-refund', c1.jwt, { orderId });
      const refunds = await refundsOf(paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        amount: 9000,
        status: 'SUCCEEDED',
        reason: 'LATE_APPROVAL',
      });
      const order = await orderRow(orderId);
      expect(order?.status).toBe('CANCELLED');
      expect(order?.payment_status).toBe('REFUNDED');
      expect(order?.paid_at).toBeNull();
      expect(order?.order_number).toBeNull();
      expect(await historyOf(orderId)).toEqual(['->PENDING_PAYMENT', 'PENDING_PAYMENT>CANCELLED']);
    });

    it('authz: customer B cannot read or act on customer A order through any function or RPC', async () => {
      const c1 = await login('customer1@theolive.local');
      const c2 = await login('customer2@theolive.local');
      const paid = await newPaidOrder(c1.jwt);
      const probes = [
        await callFn('payments-status', c2.jwt, { orderId: paid.orderId }),
        await callFn('payments-status', c2.jwt, { paymentId: paid.paymentId }),
        await callFn('payments-confirm', c2.jwt, {
          paymentId: paid.paymentId,
          providerPaymentKey: paid.key,
        }),
        await callFn('payments-refund', c2.jwt, { orderId: paid.orderId }),
      ];
      for (const reply of probes) expect(reply.body.error?.code).toBe('NOT_FOUND');
      const cancel = await c2.client.rpc('customer_cancel_order', {
        p_order_id: paid.orderId,
        p_expected_status: 'PAID',
      });
      expect(cancel.error?.message).toBe('NOT_FOUND');
      for (const table of ['orders', 'order_items', 'payments', 'order_status_history'] as const) {
        const rows = await c2.client.from(table).select('*', { head: false }).limit(5);
        if (table === 'payments') continue; // column grants make select * an error; covered below
        expect(
          (rows.data ?? []).some((r) => JSON.stringify(r).includes(paid.orderId)),
          table,
        ).toBe(false);
      }
      const payments = await c2.client.from('payments').select('id').eq('id', paid.paymentId);
      expect(payments.data).toEqual([]);
      expect((await orderRow(paid.orderId))?.status).toBe('PAID');
      // An owner whose order has no refund cannot start one.
      expect(
        (await callFn('payments-refund', c1.jwt, { orderId: paid.orderId })).body.error?.code,
      ).toBe('NOT_REFUNDABLE');
      // Owner cancel of PAID -> exactly one refund, repeated cancel/refund calls do not duplicate it.
      await c1.client.rpc('customer_cancel_order', {
        p_order_id: paid.orderId,
        p_expected_status: 'PAID',
      });
      await Promise.all(
        [1, 2, 3].map(() => callFn('payments-refund', c1.jwt, { orderId: paid.orderId })),
      );
      await c1.client.rpc('customer_cancel_order', {
        p_order_id: paid.orderId,
        p_expected_status: 'CANCELLED',
      });
      const refunds = await refundsOf(paid.paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds.reduce((s, r) => s + r.amount, 0)).toBeLessThanOrEqual(paid.amount);
      expect(refunds[0]?.status).toBe('SUCCEEDED');
    });

    it('authz: anon key, anon user, wrong role and staff probes on every function and RPC', async () => {
      const c1 = await login('customer1@theolive.local');
      const barista = await login('barista@theolive.local');
      const inactive = await login('inactive@theolive.local');
      const paid = await newPaidOrder(c1.jwt);
      for (const name of [
        'payments-checkout',
        'payments-confirm',
        'payments-status',
        'payments-refund',
        'payments-test-pg',
        'payments-reconcile',
      ]) {
        expect((await callFn(name, null, {})).status, `${name} no auth`).toBeGreaterThanOrEqual(
          401,
        );
        expect(
          (await callFn(name, anonKey ?? '', {})).status,
          `${name} anon key`,
        ).toBeGreaterThanOrEqual(401);
      }
      expect((await reconcile()).status).toBe(200);
      expect((await callFn('payments-reconcile', c1.jwt, {})).body.error?.code).toBe('FORBIDDEN');
      expect((await callFn('payments-reconcile', barista.jwt, {})).body.error?.code).toBe(
        'FORBIDDEN',
      );
      // service-only RPCs and the TEST gateway are not reachable through PostgREST for anyone but service_role.
      const serviceOnly: [string, unknown][] = [
        [
          'apply_payment_result',
          {
            p_payment_id: paid.paymentId,
            p_outcome: 'FAILED',
            p_provider_payment_id: null,
            p_amount: 0,
            p_event_id: 'x',
            p_source: 'WEBHOOK',
          },
        ],
        [
          'record_refund_result',
          {
            p_refund_id: randomUUID(),
            p_succeeded: true,
            p_provider_refund_id: 'x',
            p_message: null,
          },
        ],
        ['expire_stale_orders', {}],
        ['test_pg_create', { p_payment_id: paid.paymentId, p_amount: 1 }],
        ['test_pg_get', { p_payment_id: paid.paymentId }],
        ['test_pg_set', { p_payment_id: paid.paymentId, p_status: 'FAILED' }],
        [
          'test_pg_refund',
          { p_provider_payment_id: paid.key, p_amount: 1, p_idempotency_key: 'x' },
        ],
        ['test_pg_force_expire', { p_payment_id: paid.paymentId }],
      ];
      for (const jwt of [null, c1.jwt, barista.jwt, inactive.jwt]) {
        for (const [name, args] of serviceOnly) {
          const reply = await rest(`rpc/${name}`, jwt, { body: JSON.stringify(args) });
          expect(reply.status, `${name} ${jwt ? 'user' : 'anon'}`).toBeGreaterThanOrEqual(401);
        }
        const schemaRead = await rest('transactions?select=*', jwt, {
          method: 'GET',
          profile: 'test_pg',
        });
        expect(schemaRead.status).toBeGreaterThanOrEqual(400);
        const privateRpc = await rest('rpc/apply_payment_result', jwt, {
          body: '{}',
          profile: 'private',
        });
        expect(privateRpc.status).toBeGreaterThanOrEqual(400);
      }
      expect((await orderRow(paid.orderId))?.status).toBe('PAID');
      // Customer RPCs: anon denied.
      for (const [name, args] of [
        ['quote_checkout', { p_lines: [] }],
        [
          'staff_transition_order',
          { p_order_id: paid.orderId, p_action: 'ACCEPT', p_expected_status: 'PAID' },
        ],
        ['customer_cancel_order', { p_order_id: paid.orderId, p_expected_status: 'PAID' }],
        [
          'staff_cancel_order',
          { p_order_id: paid.orderId, p_expected_status: 'PAID', p_reason: 'x' },
        ],
      ] as const) {
        expect(
          (await rest(`rpc/${name}`, null, { body: JSON.stringify(args) })).status,
          `anon ${name}`,
        ).toBeGreaterThanOrEqual(401);
      }
      // Staff RPCs: customer, inactive staff denied; non-admin staff cannot admin-cancel.
      const accept = {
        p_order_id: paid.orderId,
        p_action: 'ACCEPT',
        p_expected_status: 'PAID' as const,
      };
      expect((await c1.client.rpc('staff_transition_order', accept)).error?.message).toBe(
        'FORBIDDEN',
      );
      expect((await inactive.client.rpc('staff_transition_order', accept)).error?.message).toBe(
        'FORBIDDEN',
      );
      expect(
        (
          await barista.client.rpc('staff_cancel_order', {
            p_order_id: paid.orderId,
            p_expected_status: 'PAID',
            p_reason: 'x',
          })
        ).error?.message,
      ).toBe('FORBIDDEN');
      expect(
        (
          await inactive.client.rpc('staff_cancel_order', {
            p_order_id: paid.orderId,
            p_expected_status: 'PAID',
            p_reason: 'x',
          })
        ).error?.message,
      ).toBe('FORBIDDEN');
      // Inactive staff cannot see the order or the payment through RLS.
      expect(
        (await inactive.client.from('orders').select('id').eq('id', paid.orderId)).data,
      ).toEqual([]);
      expect(
        (await inactive.client.from('payments').select('id').eq('id', paid.paymentId)).data,
      ).toEqual([]);
      expect(
        (await callFn('payments-status', inactive.jwt, { orderId: paid.orderId })).body.error?.code,
      ).toBe('NOT_FOUND');
      expect((await orderRow(paid.orderId))?.status).toBe('PAID');
    });

    it('direct table writes by the order owner (bypassing the RPCs) are all refused and change nothing', async () => {
      const c1 = await login('customer1@theolive.local');
      const paid = await newPaidOrder(c1.jwt);
      const before = await orderRow(paid.orderId);
      const attempts = [
        c1.client.from('orders').update({ status: 'COMPLETED' }).eq('id', paid.orderId).select(),
        c1.client
          .from('orders')
          .update({ payment_status: 'REFUNDED', paid_amount: 0, menu_amount: 0 })
          .eq('id', paid.orderId)
          .select(),
        c1.client.from('orders').delete().eq('id', paid.orderId).select(),
        c1.client
          .from('order_items')
          .update({ unit_price: 1 })
          .eq('order_id', paid.orderId)
          .select(),
        c1.client
          .from('order_items')
          .insert({ order_id: paid.orderId, name_snapshot: 'x', quantity: 1, unit_price: 0 })
          .select(),
        c1.client
          .from('order_status_history')
          .insert({ order_id: paid.orderId, to_status: 'COMPLETED', actor_role: 'CUSTOMER' })
          .select(),
        c1.client.from('order_status_history').delete().eq('order_id', paid.orderId).select(),
        c1.client
          .from('payments')
          .update({ status: 'REFUNDED', amount: 1 })
          .eq('id', paid.paymentId)
          .select(),
        c1.client
          .from('payments')
          .insert({
            order_id: paid.orderId,
            provider: 'TEST',
            method: 'CARD',
            amount: 0,
            idempotency_key: randomUUID(),
          })
          .select(),
        c1.client
          .from('refunds')
          .insert({
            payment_id: paid.paymentId,
            amount: 4500,
            reason: 'x',
            idempotency_key: randomUUID(),
          })
          .select(),
        c1.client.from('payment_events').select('id'),
        c1.client.from('order_number_counters').select('*'),
      ];
      for (const attempt of attempts) {
        const { data, error } = await attempt;
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
      expect(await orderRow(paid.orderId)).toEqual(before);
      expect(await refundsOf(paid.paymentId)).toEqual([]);
      const items =
        (await service().from('order_items').select('unit_price').eq('order_id', paid.orderId))
          .data ?? [];
      expect(items.every((i) => i.unit_price === 4500)).toBe(true);
      // Provider ids / idempotency keys are not readable by the customer.
      const leak = await c1.client
        .from('payments')
        .select('provider_payment_id, idempotency_key')
        .eq('id', paid.paymentId);
      expect(leak.error).not.toBeNull();
    });

    it('state machine: illegal staff transitions, late customer cancel, reject path and complete history', async () => {
      const c1 = await login('customer1@theolive.local');
      const staff = await login('barista@theolive.local');
      const rpc = (
        action: string,
        expected: Database['public']['Enums']['order_status'],
        extra: Record<string, unknown> = {},
        id = '',
      ) =>
        staff.client.rpc('staff_transition_order', {
          p_order_id: id,
          p_action: action,
          p_expected_status: expected,
          ...extra,
        });
      const paid = await newPaidOrder(c1.jwt);
      const id = paid.orderId;
      const err = async (promise: PromiseLike<{ error: { message: string } | null }>) =>
        (await promise).error?.message;
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'COMPLETE',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBe('INVALID_TRANSITION');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'START_PREPARING',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBe('INVALID_TRANSITION');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'NUKE',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBe('INVALID_INPUT');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'REJECT',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBe('REASON_REQUIRED');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'REJECT',
            p_expected_status: 'PAID',
            p_reason_code: 'OTHER',
          }),
        ),
      ).toBe('REASON_REQUIRED');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'ACCEPT',
            p_expected_status: 'READY',
          }),
        ),
      ).toBe('STALE_STATUS');
      void rpc;
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'ACCEPT',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBeUndefined();
      const replay = await staff.client.rpc('staff_transition_order', {
        p_order_id: id,
        p_action: 'ACCEPT',
        p_expected_status: 'ACCEPTED',
      });
      expect((replay.data as { isReplay: boolean }).isReplay).toBe(true);
      // After ACCEPTED: the customer cannot cancel, staff cannot reject, no refund appears.
      expect(
        (
          await c1.client.rpc('customer_cancel_order', {
            p_order_id: id,
            p_expected_status: 'ACCEPTED',
          })
        ).error?.message,
      ).toBe('INVALID_TRANSITION');
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: id,
            p_action: 'REJECT',
            p_expected_status: 'ACCEPTED',
            p_reason_code: 'TOO_BUSY',
          }),
        ),
      ).toBe('INVALID_TRANSITION');
      expect(
        await err(
          staff.client.rpc('staff_cancel_order', {
            p_order_id: id,
            p_expected_status: 'ACCEPTED',
            p_reason: 'x',
          }),
        ),
      ).toBe('FORBIDDEN');
      expect(await refundsOf(paid.paymentId)).toEqual([]);
      for (const [action, expected] of [
        ['START_PREPARING', 'ACCEPTED'],
        ['MARK_READY', 'PREPARING'],
        ['COMPLETE', 'READY'],
      ] as const) {
        expect(
          await err(
            staff.client.rpc('staff_transition_order', {
              p_order_id: id,
              p_action: action,
              p_expected_status: expected as 'PAID',
            }),
          ),
        ).toBeUndefined();
      }
      expect(await historyOf(id)).toEqual([
        '->PENDING_PAYMENT',
        'PENDING_PAYMENT>PAID',
        'PAID>ACCEPTED',
        'ACCEPTED>PREPARING',
        'PREPARING>READY',
        'READY>COMPLETED',
      ]);
      // Terminal order: nothing moves it, admin cancel refused, no refund.
      expect(
        (
          await c1.client.rpc('customer_cancel_order', {
            p_order_id: id,
            p_expected_status: 'COMPLETED',
          })
        ).error?.message,
      ).toBe('INVALID_TRANSITION');
      const admin = await login('admin@theolive.local');
      expect(
        (
          await admin.client.rpc('staff_cancel_order', {
            p_order_id: id,
            p_expected_status: 'COMPLETED',
            p_reason: 'x',
          })
        ).error?.message,
      ).toBe('INVALID_TRANSITION');
      expect(await refundsOf(paid.paymentId)).toEqual([]);
      // Staff cannot see or move an unpaid order (PAY-05).
      const unpaid = await callFn('payments-checkout', c1.jwt, checkoutBody());
      expect(
        await err(
          staff.client.rpc('staff_transition_order', {
            p_order_id: String(unpaid.body.orderId),
            p_action: 'ACCEPT',
            p_expected_status: 'PAID',
          }),
        ),
      ).toBe('NOT_FOUND');
      // Parallel REJECT vs customer cancel on a PAID order: exactly one winner, exactly one refund of the full amount.
      const race = await newPaidOrder(c1.jwt);
      await Promise.all([
        staff.client.rpc('staff_transition_order', {
          p_order_id: race.orderId,
          p_action: 'REJECT',
          p_expected_status: 'PAID',
          p_reason_code: 'CLOSING',
        }),
        c1.client.rpc('customer_cancel_order', {
          p_order_id: race.orderId,
          p_expected_status: 'PAID',
        }),
        staff.client.rpc('staff_transition_order', {
          p_order_id: race.orderId,
          p_action: 'ACCEPT',
          p_expected_status: 'PAID',
        }),
      ]);
      await Promise.all(
        [1, 2].map(() => callFn('payments-refund', c1.jwt, { orderId: race.orderId })),
      );
      const finalState = await orderRow(race.orderId);
      const history = await historyOf(race.orderId);
      expect(['REJECTED', 'CANCELLED', 'ACCEPTED']).toContain(finalState?.status);
      expect(history).toHaveLength(3);
      const refunds = await refundsOf(race.paymentId);
      if (finalState?.status === 'ACCEPTED') expect(refunds).toHaveLength(0);
      else {
        expect(refunds).toHaveLength(1);
        expect(refunds[0]?.amount).toBe(race.amount);
      }
    });

    it('zero-amount orders: complete history and no refund path', async () => {
      const c1 = await login('customer1@theolive.local');
      const category =
        (await service().from('menu_items').select('category_id').eq('id', AMERICANO).single()).data
          ?.category_id ?? '';
      const free = randomUUID();
      await service().from('menu_items').insert({
        id: free,
        category_id: category,
        name: 'QA free',
        price: 0,
        temperatures: [],
        is_active: true,
      });
      const reply = await callFn(
        'payments-checkout',
        c1.jwt,
        checkoutBody({ lines: [{ menuItemId: free, temperature: null, quantity: 1 }] }),
      );
      expect(reply.status).toBe(200);
      expect(reply.body.status).toBe('PAID');
      expect(await historyOf(String(reply.body.orderId))).toEqual([
        '->PENDING_PAYMENT',
        'PENDING_PAYMENT>PAID',
      ]);
      expect(
        (await callFn('payments-refund', c1.jwt, { orderId: String(reply.body.orderId) })).body
          .error?.code,
      ).toBe('NOT_REFUNDABLE');
      // Hard delete is impossible once ordered (order_items FK set null trips the APPEND_ONLY trigger); archive instead.
      await service()
        .from('menu_items')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', free);
    });

    it('realtime: customers, inactive staff and anon cannot join store:orders or another user topic', async () => {
      const c1 = await login('customer1@theolive.local');
      const c2 = await login('customer2@theolive.local');
      const inactive = await login('inactive@theolive.local');
      const join = async (client: TypedSupabaseClient, topic: string) => {
        const channel = client.channel(topic, { config: { private: true } });
        const state = await new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve('TIMEOUT'), 6000);
          channel.subscribe((s) => {
            if (s !== ('SUBSCRIBING' as string)) {
              clearTimeout(timer);
              resolve(s);
            }
          });
        });
        await client.removeChannel(channel);
        return state;
      };
      expect(await join(c1.client, 'store:orders')).not.toBe('SUBSCRIBED');
      expect(await join(inactive.client, 'store:orders')).not.toBe('SUBSCRIBED');
      expect(await join(anon(), 'store:orders')).not.toBe('SUBSCRIBED');
      const [, c1Id] = [0, '00000000-0000-4000-8000-0000000000c1'];
      expect(await join(c2.client, `user:${c1Id}`)).not.toBe('SUBSCRIBED');
      expect(await join(c1.client, `user:${c1Id}`)).toBe('SUBSCRIBED');
      // A customer cannot publish into the staff topic either.
      const channel = c1.client.channel('store:orders', { config: { private: true } });
      const sendState = await new Promise<string>((resolve) => {
        channel.subscribe((s) => {
          if (s !== ('SUBSCRIBING' as string)) resolve(s);
        });
        setTimeout(() => resolve('TIMEOUT'), 6000);
      });
      expect(sendState).not.toBe('SUBSCRIBED');
      await c1.client.removeChannel(channel);
    }, 90_000);

    it('webhook: replayed valid signature with a mismatched amount on an open payment cancels at the provider and never marks it paid', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const paymentId = String(checkout.body.paymentId);
      const next = checkout.body.nextAction as { checkoutToken: string };
      await callFn('payments-test-pg', c1.jwt, {
        checkoutToken: next.checkoutToken,
        scenario: 'SUCCESS',
      });
      const providerId = (
        (await service().rpc('test_pg_get', { p_payment_id: paymentId })).data as { id: string }
      ).id;
      expect(
        await webhook({
          eventId: `qa-mis-${paymentId}`,
          type: 'PAYMENT_APPROVED',
          paymentId,
          providerPaymentId: providerId,
          amount: 100,
        }),
      ).toBe(200);
      const order = await orderRow(String(checkout.body.orderId));
      expect(order?.status).toBe('CANCELLED');
      expect(order?.paid_at).toBeNull();
      expect(
        await webhook({
          eventId: `qa-mis2-${paymentId}`,
          type: 'PAYMENT_APPROVED',
          paymentId,
          providerPaymentId: providerId,
          amount: 4500,
        }),
      ).toBe(200);
      expect((await orderRow(String(checkout.body.orderId)))?.status).toBe('CANCELLED');
    });

    it('DEFECT: an approval whose webhook was lost, landing after the order expired, is never found by reconcile (customer charged, no refund)', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const paymentId = String(checkout.body.paymentId);
      // The provider approves; no webhook arrives and the app is dead. Then the once-a-minute expiry cron runs.
      await service().rpc('test_pg_set', {
        p_payment_id: paymentId,
        p_status: 'APPROVED',
        p_approved_amount: 4500,
      });
      await service().rpc('test_pg_force_expire', { p_payment_id: paymentId });
      await service()
        .from('payments')
        .update({ requested_at: new Date(Date.now() - 600_000).toISOString() })
        .eq('id', paymentId);
      await reconcile();
      await reconcile();
      const provider = (await service().rpc('test_pg_get', { p_payment_id: paymentId })).data as {
        status: string;
      };
      // Money was taken at the provider; the system must end with the customer refunded.
      expect(provider.status).toBe('REFUNDED');
      expect((await refundsOf(paymentId)).length).toBe(1);
    });

    it('DEFECT: a failed provider-side cancel after an amount-mismatch approval is never retried', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const paymentId = String(checkout.body.paymentId);
      const next = checkout.body.nextAction as { checkoutToken: string };
      const decision = await callFn('payments-test-pg', c1.jwt, {
        checkoutToken: next.checkoutToken,
        scenario: 'AMOUNT_MISMATCH',
      });
      await service().rpc('test_pg_set', {
        p_payment_id: paymentId,
        p_status: 'APPROVED',
        p_refund_failures: 1,
      });
      const confirm = await callFn('payments-confirm', c1.jwt, {
        paymentId,
        providerPaymentKey: String(decision.body.providerPaymentKey),
      });
      expect(confirm.body.error?.code).toBe('PAYMENT_AMOUNT_MISMATCH');
      await reconcile();
      await reconcile();
      const provider = (await service().rpc('test_pg_get', { p_payment_id: paymentId })).data as {
        status: string;
      };
      expect(provider.status).toBe('REFUNDED');
    });

    it('a signed APPROVED webhook without a provider payment id never marks the payment PAID (left for reconcile)', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const paymentId = String(checkout.body.paymentId);
      for (const providerPaymentId of [null, '']) {
        expect(
          await webhook({
            eventId: randomUUID(),
            type: 'PAYMENT_APPROVED',
            paymentId,
            providerPaymentId,
            amount: 4500,
          }),
        ).toBe(200);
      }
      const order = await orderRow(String(checkout.body.orderId));
      expect([order?.status, order?.payment_status]).toEqual(['PENDING_PAYMENT', 'READY']);
    });

    it('a late approval after expiry is also found by payments-status for the owner, and refunded exactly once under concurrency', async () => {
      const c1 = await login('customer1@theolive.local');
      const checkout = await callFn('payments-checkout', c1.jwt, checkoutBody());
      const paymentId = String(checkout.body.paymentId);
      await service().rpc('test_pg_set', {
        p_payment_id: paymentId,
        p_status: 'APPROVED',
        p_approved_amount: 4500,
      });
      await service().rpc('test_pg_force_expire', { p_payment_id: paymentId });
      await Promise.all([
        callFn('payments-status', c1.jwt, { paymentId }),
        reconcile(),
        callFn('payments-status', c1.jwt, { paymentId }),
        reconcile(),
      ]);
      const provider = (await service().rpc('test_pg_get', { p_payment_id: paymentId })).data as {
        status: string;
      };
      expect(provider.status).toBe('REFUNDED');
      expect((await refundsOf(paymentId)).length).toBe(1);
      expect((await orderRow(String(checkout.body.orderId)))?.status).toBe('CANCELLED');
    });

    it('invariants over every order in the database: refunds never exceed the payment, history chains, one captured payment', async () => {
      const db = service();
      const refunds = (await db.from('refunds').select('payment_id, amount, status')).data ?? [];
      const payments = new Map(
        ((await db.from('payments').select('id, amount')).data ?? []).map((p) => [p.id, p.amount]),
      );
      const totals = new Map<string, number>();
      for (const r of refunds) totals.set(r.payment_id, (totals.get(r.payment_id) ?? 0) + r.amount);
      for (const [paymentId, total] of totals)
        expect(total, paymentId).toBeLessThanOrEqual(payments.get(paymentId) ?? 0);
      const orders =
        (
          await db
            .from('orders')
            .select('id, status, paid_at, order_number, paid_amount, menu_amount')
        ).data ?? [];
      const history =
        (
          await db
            .from('order_status_history')
            .select('order_id, from_status, to_status')
            .order('id')
        ).data ?? [];
      for (const order of orders) {
        const rows = history.filter((h) => h.order_id === order.id);
        expect(rows[0]?.to_status, order.id).toBe('PENDING_PAYMENT');
        expect(rows[rows.length - 1]?.to_status, order.id).toBe(order.status);
        rows
          .slice(1)
          .forEach((row, index) => expect(row.from_status, order.id).toBe(rows[index]?.to_status));
        expect(order.order_number !== null, order.id).toBe(order.paid_at !== null);
        const items =
          (await db.from('order_items').select('line_total').eq('order_id', order.id)).data ?? [];
        expect(
          items.reduce((s, i) => s + (i.line_total ?? 0), 0),
          order.id,
        ).toBe(order.menu_amount);
      }
    });
  },
);
