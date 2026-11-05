import {
  nextStampGoal,
  useCheckoutQuote,
  useMyCoupons,
  useRedeemStamps,
  useStampBalance,
  useStampExchangeOptions,
  useStampLedger,
  type CheckoutQuoteLine,
  type StampLedgerEntryView,
} from '@theolive/api';

import { useSession } from '@/hooks/useAuth';
import { formatKstDate } from '@/lib/format';
import { combineStates, toQueryState, type QueryState } from '@/lib/queryState';
import type { Coupon, LedgerEntry, LedgerKind, StampExchangeOption, StampSummary } from '@/models';
import { supabase } from '@/services/supabase';

function useUserId(): string | null {
  return useSession().session?.user.id ?? null;
}

const LEDGER_KIND: Record<StampLedgerEntryView['kind'], LedgerKind> = {
  EARN: 'EARN',
  REDEEM: 'USE',
  EARN_REVERSAL: 'CANCEL',
  REDEEM_RESTORE: 'CANCEL',
  EXPIRE: 'USE',
  FORFEIT: 'USE',
  ADJUST: 'EARN',
};

/** Own stamp balance and the next exchange goal (HOME-04); the server decides what is exchangeable. */
export function useStampsQuery(): QueryState<StampSummary> {
  const balance = toQueryState(useStampBalance(supabase, useUserId()));
  const options = toQueryState(useStampExchangeOptions(supabase));
  const combined = combineStates(balance, options);
  if (combined.status !== 'success') return combined;
  const [count, rules] = combined.data;
  return {
    status: 'success',
    data: {
      count,
      goal: nextStampGoal(
        count,
        rules.map((rule) => rule.requiredStamps),
      ),
    },
  };
}

export function useStampExchangeQuery(): QueryState<StampExchangeOption[]> {
  return toQueryState(useStampExchangeOptions(supabase));
}

export function useCouponsQuery(): QueryState<Coupon[]> {
  return toQueryState(useMyCoupons(supabase, useUserId()));
}

export function useStampLedgerQuery(): QueryState<LedgerEntry[]> {
  const state = toQueryState(useStampLedger(supabase, useUserId()));
  if (state.status !== 'success') return state;
  return {
    status: 'success',
    data: state.data.map((entry) => ({
      id: String(entry.id),
      kind: LEDGER_KIND[entry.kind],
      label: entry.label,
      amount: entry.delta,
      at: formatKstDate(entry.createdAt),
    })),
  };
}

export const useRedeemStampsMutation = () => useRedeemStamps(supabase);

/**
 * The server's price for the cart with the chosen coupon and points (PAY-01..03). The raw query result is returned so
 * checkout can read the error code of a rejected coupon (expired, not usable) and drop the selection.
 */
export function useCheckoutQuoteResult(
  lines: CheckoutQuoteLine[],
  userCouponId: string | null,
  pointsToUse: number,
) {
  return useCheckoutQuote(supabase, lines, userCouponId, pointsToUse);
}
