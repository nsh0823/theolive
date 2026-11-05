import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@theolive/types';

import { signInWithEmail } from './auth';
import type { TypedSupabaseClient } from './client';
import { cancelMyOrder, fetchOrder } from './orders';
import {
  confirmPayment,
  createCheckout,
  runTestPayment,
  type CheckoutInput,
  type CheckoutResult,
} from './payments';
import {
  fetchPointLedger,
  fetchPointSummary,
  registerPointCode,
  PointCodeRejectedError,
} from './points';
import {
  fetchPointCodes,
  fetchPointPolicy,
  issuePointCodes,
  voidPointCode,
  type IssuedPointCode,
} from './pointsAdmin';
import { fetchCheckoutQuote } from './rewards';
import { transitionOrder } from './staffOrders';

// Runs against the LOCAL Supabase stack with `supabase functions serve --env-file supabase/functions/.env` running
// (same env as orders.integration.test.ts). TEST PAYMENT GATEWAY ONLY. Each run signs up its own customers and issues
// its own codes through the admin RPC, so it needs no database reset and leaves the seed customers alone.
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const serviceKey = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const SEED_PASSWORD = 'olive-local-1234';
const AMERICANO = '00000000-0000-4000-8000-000000000201';
const AMERICANO_PRICE = 4500;
const POINT_AMOUNT = 5000;
const MS_PER_DAY = 86_400_000;
const EXPIRY_DAYS = 30;

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
  const email = `points-${randomUUID()}@theolive.local`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { nickname: '포인트테스트' },
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

async function expectRejected(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

/** Issues a batch and returns its codes (the only time they are readable in full). */
async function issue(
  admin: TypedSupabaseClient,
  quantity: number,
  amount = POINT_AMOUNT,
): Promise<IssuedPointCode[]> {
  const expiresOn = new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  return issuePointCodes(admin, {
    amount,
    quantity,
    expiresOn,
    memo: `it-${randomUUID().slice(0, 8)}`,
  });
}

function codeAt(codes: IssuedPointCode[], index: number): string {
  const found = codes[index];
  if (!found) throw new Error('missing code');
  return found.code;
}

describe.skipIf(!url || !anonKey || !serviceKey)(
  'Coupon Points against local Supabase (TEST PG)',
  () => {
    it('registers a code once, holds and captures points at checkout, and restores them on refund', async () => {
      const admin = await signedIn('admin@theolive.local');
      const barista = await signedIn('barista@theolive.local');
      const { id: userId, client: customer } = await newCustomer();
      const other = await newCustomer();
      const codes = await issue(admin, 3);

      // Registration, and the ways it is refused.
      expect(
        await registerPointCode(customer, ` ${codeAt(codes, 0).toLowerCase()} `),
      ).toMatchObject({
        amount: POINT_AMOUNT,
        balance: POINT_AMOUNT,
      });
      expect(await fetchPointSummary(customer)).toMatchObject({
        balance: POINT_AMOUNT,
        held: 0,
        available: POINT_AMOUNT,
      });
      await expectRejected(
        registerPointCode(customer, codeAt(codes, 0)),
        'CODE_ALREADY_REGISTERED',
      );
      await expectRejected(
        registerPointCode(other.client, codeAt(codes, 0)),
        'CODE_ALREADY_REGISTERED',
      );
      await expectRejected(registerPointCode(customer, 'OLIVE-ZZZZ-ZZZZ'), 'CODE_INVALID');
      const ledger = await fetchPointLedger(customer, userId);
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ kind: 'REGISTER', delta: POINT_AMOUNT });

      // Codes are not readable by customers; the admin sees them masked and finds one by its full code.
      const readable = await customer.from('coupon_point_codes').select('*');
      expect(readable.data).toEqual([]);
      const listed = await fetchPointCodes(admin, {
        status: null,
        search: codeAt(codes, 0),
        limit: 10,
        offset: 0,
      });
      expect(listed.codes).toHaveLength(1);
      expect(listed.codes[0]).toMatchObject({ status: 'REGISTERED', remaining: POINT_AMOUNT });
      expect(JSON.stringify(listed)).not.toContain(codeAt(codes, 0));
      const policy = await fetchPointPolicy(customer);
      expect(policy).toMatchObject({ minUseAmount: 0, useUnit: 1, maxUsePerOrder: null });

      // The server quote clamps the request; the app never computes the total.
      const lines = [{ menuItemId: AMERICANO, temperature: 'HOT' as const, quantity: 1 }];
      expect(await fetchCheckoutQuote(customer, lines, null, 99_999)).toMatchObject({
        pointsUsed: AMERICANO_PRICE,
        paidAmount: 0,
        pointsAvailable: POINT_AMOUNT,
        maxPointsUsable: AMERICANO_PRICE,
      });

      // Hold at checkout, capture at payment.
      const paid = await createCheckout(customer, input({ pointsToUse: 3000 }));
      expect(paid).toMatchObject({ amount: AMERICANO_PRICE - 3000, pointsUsed: 3000 });
      expect(await fetchPointSummary(customer)).toMatchObject({
        held: 3000,
        available: 2000,
        balance: POINT_AMOUNT,
      });
      expect(await fetchPointLedger(customer, userId)).toHaveLength(1);
      await expectRejected(
        createCheckout(customer, input({ pointsToUse: 2001 })),
        'POINTS_EXCEED_BALANCE',
      );
      await settle(customer, paid);
      expect(await fetchOrder(customer, paid.orderId)).toMatchObject({
        status: 'PAID',
        pointsUsed: 3000,
        paidAmount: 1500,
      });
      expect(await fetchPointSummary(customer)).toMatchObject({
        balance: 2000,
        held: 0,
        available: 2000,
      });
      expect((await fetchPointLedger(customer, userId))[0]).toMatchObject({
        kind: 'USE',
        delta: -3000,
      });

      // A reject refunds the payment and gives the points back.
      await transitionOrder(barista, {
        orderId: paid.orderId,
        action: 'REJECT',
        expectedStatus: 'PAID',
        reasonCode: 'TOO_BUSY',
      });
      expect(await fetchOrder(customer, paid.orderId)).toMatchObject({ paymentStatus: 'REFUNDED' });
      expect(await fetchPointSummary(customer)).toMatchObject({
        balance: POINT_AMOUNT,
        available: POINT_AMOUNT,
      });
      expect((await fetchPointLedger(customer, userId))[0]).toMatchObject({
        kind: 'REFUND_RESTORE',
        delta: 3000,
      });

      // A failed payment and a customer cancel release the hold without touching the ledger.
      const failing = await createCheckout(customer, input({ pointsToUse: 2000 }));
      if (failing.nextAction.type !== 'TEST_SHEET') throw new Error('expected a payment sheet');
      await runTestPayment(customer, {
        checkoutToken: failing.nextAction.checkoutToken,
        scenario: 'FAIL',
      });
      expect(await fetchPointSummary(customer)).toMatchObject({ held: 0, available: POINT_AMOUNT });
      const abandoned = await createCheckout(customer, input({ pointsToUse: 2000 }));
      expect((await fetchPointSummary(customer)).held).toBe(2000);
      await cancelMyOrder(customer, {
        orderId: abandoned.orderId,
        expectedStatus: 'PENDING_PAYMENT',
      });
      expect(await fetchPointSummary(customer)).toMatchObject({ held: 0, available: POINT_AMOUNT });

      // Points can cover 100%: no provider payment, the order is paid at once.
      const free = await createCheckout(customer, input({ pointsToUse: AMERICANO_PRICE }));
      expect(free).toMatchObject({ amount: 0, status: 'PAID', nextAction: { type: 'NONE' } });
      expect((await fetchPointSummary(customer)).balance).toBe(POINT_AMOUNT - AMERICANO_PRICE);

      // Voiding: only an unregistered code.
      await voidPointCode(admin, codes[1]?.id ?? '');
      await expectRejected(registerPointCode(other.client, codeAt(codes, 1)), 'CODE_VOID');
      await expectRejected(voidPointCode(admin, codes[0]?.id ?? ''), 'CODE_ALREADY_REGISTERED');
      await expectRejected(voidPointCode(customer, codes[2]?.id ?? ''), 'FORBIDDEN');
      await expectRejected(issue(customer, 1), 'FORBIDDEN');
    }, 120_000);

    it('lets exactly one of two members register the same code at the same time', async () => {
      const admin = await signedIn('admin@theolive.local');
      const [a, b] = [await newCustomer(), await newCustomer()];
      const codes = await issue(admin, 1);
      const race = await Promise.allSettled([
        registerPointCode(a.client, codeAt(codes, 0)),
        registerPointCode(b.client, codeAt(codes, 0)),
      ]);
      expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = race.find((r) => r.status === 'rejected');
      expect(loser?.status === 'rejected' && loser.reason).toMatchObject({
        code: 'CODE_ALREADY_REGISTERED',
      });
      const balances = [await fetchPointSummary(a.client), await fetchPointSummary(b.client)];
      expect(balances.map((s) => s.balance).sort()).toEqual([0, POINT_AMOUNT]);
    }, 60_000);

    it('blocks the sixth entry in ten minutes, per account', async () => {
      const admin = await signedIn('admin@theolive.local');
      const guesser = await newCustomer();
      const bystander = await newCustomer();
      const codes = await issue(admin, 1);
      for (let n = 0; n < 5; n += 1) {
        await expectRejected(
          registerPointCode(guesser.client, `OLIVE-NOPE-000${n}`),
          'CODE_INVALID',
        );
      }
      const blocked = await registerPointCode(guesser.client, codeAt(codes, 0)).catch(
        (e: unknown) => e,
      );
      if (!(blocked instanceof PointCodeRejectedError)) throw new Error('expected a rejection');
      expect(blocked.code).toBe('TOO_MANY_ATTEMPTS');
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect((await fetchPointSummary(guesser.client)).balance).toBe(0);
      // Another account is unaffected, and the blocked call did not use up the code.
      expect(await registerPointCode(bystander.client, codeAt(codes, 0))).toMatchObject({
        amount: POINT_AMOUNT,
      });
    }, 60_000);

    it('never overspends with parallel checkouts that compete for one balance', async () => {
      const admin = await signedIn('admin@theolive.local');
      const { id: userId, client: customer } = await newCustomer();
      await registerPointCode(customer, codeAt(await issue(admin, 1), 0));
      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () => createCheckout(customer, input({ pointsToUse: 3000 }))),
      );
      const won = attempts.filter((r) => r.status === 'fulfilled');
      expect(won).toHaveLength(1);
      for (const lost of attempts.filter((r) => r.status === 'rejected')) {
        expect(lost.reason).toMatchObject({ code: 'POINTS_EXCEED_BALANCE' });
      }
      const summary = await fetchPointSummary(customer);
      expect(summary).toMatchObject({ held: 3000, available: 2000, balance: POINT_AMOUNT });
      const winner = won[0];
      if (winner?.status !== 'fulfilled') throw new Error('no winner');
      await settle(customer, winner.value);
      const ledger = await fetchPointLedger(customer, userId);
      expect(ledger.reduce((sum, row) => sum + row.delta, 0)).toBe(2000);
      expect((await fetchPointSummary(customer)).balance).toBe(2000);
    }, 90_000);
  },
);
