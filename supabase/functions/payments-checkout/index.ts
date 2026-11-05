// payments-checkout: creates the PENDING_PAYMENT order and its payment, then asks the provider how the customer
// pays. The server recomputes every price and the coupon discount (the request carries none); the order RPC rejects closed
// or paused stores and unavailable, sold-out or archived items. Idempotent per clientRequestId.
import { z } from 'zod';

import { adminClient, authenticate } from '../_shared/clients.ts';
import { HttpError, codeFromRpcError, HTTP } from '../_shared/errors.ts';
import { jsonResponse, readJson, serveFunction } from '../_shared/http.ts';
import type { NextAction } from '../_shared/payments/provider.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import { checkoutRequestSchema } from '../_shared/validation/checkout.ts';

const RETURN_URL = 'theolive://payment/return';

const checkoutResultSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  amount: z.number(),
  // The server's discount: the app shows these and never computes them.
  menuAmount: z.number(),
  couponDiscount: z.number(),
  pointsUsed: z.number(),
  userCouponId: z.string().nullable(),
  status: z.string(),
  paymentStatus: z.string(),
  orderNumber: z.string().nullable(),
  isReplay: z.boolean(),
});

serveFunction('payments-checkout', async (request) => {
  const { client } = await authenticate(request);
  const parsed = checkoutRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');
  const input = parsed.data;

  const { data, error } = await client.rpc('create_checkout_order', {
    p_client_request_id: input.clientRequestId,
    p_order_type: input.orderType,
    p_lines: input.lines,
    p_user_coupon_id: input.userCouponId,
    p_points_to_use: input.pointsToUse,
    p_payment_method: input.paymentMethod,
    p_note: input.note,
  });
  if (error) throw new HttpError(codeFromRpcError(error));
  const order = checkoutResultSchema.parse(data);

  // Only an unpaid order with something to pay needs the provider; replays get a fresh sheet token.
  let nextAction: NextAction = { type: 'NONE' };
  if (order.paymentStatus === 'READY' && order.amount > 0) {
    const admin = adminClient();
    const { data: items, error: itemsError } = await admin
      .from('order_items')
      .select('name_snapshot')
      .eq('order_id', order.orderId)
      .order('sort_order');
    if (itemsError) throw itemsError;
    const names = (items ?? []).map((item) => String(item.name_snapshot));
    const orderName =
      names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : (names[0] ?? '주문');
    try {
      nextAction = await getPaymentProvider(admin).prepare({
        paymentId: order.paymentId,
        amount: order.amount,
        orderName,
        method: input.paymentMethod,
        returnUrl: RETURN_URL,
      });
    } catch (providerError) {
      console.error('Payment provider prepare failed', order.paymentId, providerError);
      throw new HttpError('PAYMENT_PROVIDER_UNAVAILABLE');
    }
  }

  return jsonResponse(HTTP.OK, { ...order, nextAction });
});
