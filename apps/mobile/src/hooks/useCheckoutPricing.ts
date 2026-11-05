import { useMemo, useState } from 'react';

import { useCheckoutQuoteResult, useCouponsQuery } from '@/hooks/useRewards';
import { userMessage } from '@/lib/errorMessage';
import type { CartLine, Coupon } from '@/models';
import { COUPON_STATUS } from '@/models';

/**
 * Coupon and Coupon Points choice at checkout (RW-04, PAY-02, PAY-03). The server quotes the cart with the chosen
 * coupon and the requested points; this hook only passes its answer along, so neither the discount nor the points
 * applied is ever computed on the device. A coupon the server rejects (expired, taken by another order) is dropped
 * from the selection and the reason is returned as `notice`; the points request stays and is priced again.
 */
export function useCheckoutPricing(lines: CartLine[]) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  // What the member asked for. The amount that is applied and sent is `quote.pointsUsed`, the server's clamp.
  const [requestedPoints, setRequestedPoints] = useState(0);
  const quoteLines = useMemo(
    () =>
      lines.map(({ menuItemId, temperature, quantity }) => ({ menuItemId, temperature, quantity })),
    [lines],
  );
  const base = useCheckoutQuoteResult(quoteLines, null, 0);
  const chosen = useCheckoutQuoteResult(quoteLines, pickedId, requestedPoints);
  const withoutCoupon = useCheckoutQuoteResult(quoteLines, null, requestedPoints);
  const wallet = useCouponsQuery();

  // A rejected coupon is treated as not picked (derived, so no state is set from an effect).
  const rejection = pickedId !== null ? chosen.error : null;
  const selectedId = rejection === null ? pickedId : null;
  const notice = rejection === null ? null : userMessage(rejection);
  const active = rejection === null ? chosen : withoutCoupon;

  const usableIds = base.data?.usableCouponIds ?? [];
  const usableCoupons: Coupon[] =
    wallet.status === 'success'
      ? wallet.data.filter(
          (coupon) => coupon.status === COUPON_STATUS.AVAILABLE && usableIds.includes(coupon.id),
        )
      : [];
  const quote = active.data ?? base.data ?? null;
  // Paying before the server has priced the choice would show a stale amount.
  const isPricing =
    (selectedId !== null || requestedPoints > 0) &&
    (active.isFetching || active.data === undefined);

  return {
    selectedId,
    select: setPickedId,
    clear: () => setPickedId(null),
    usableCoupons,
    quote,
    isPricing,
    notice,
    requestedPoints,
    requestPoints: setRequestedPoints,
    pointsAvailable: base.data?.pointsAvailable ?? 0,
    maxPointsUsable: quote?.maxPointsUsable ?? 0,
  };
}
