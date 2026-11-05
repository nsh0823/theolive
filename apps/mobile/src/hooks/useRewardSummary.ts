import { useRewardSummary } from '@theolive/api';

import { useSession } from '@/hooks/useAuth';
import { toQueryState, type QueryState } from '@/lib/queryState';
import type { PointSummary, StampSummary } from '@/models';
import { supabase } from '@/services/supabase';

/** HOME-04: what Home shows, from one server call. Stamps and Coupon Points stay separate fields. */
export type HomeRewards = { stamps: StampSummary; points: PointSummary; couponCount: number };

export function useRewardSummaryQuery(): QueryState<HomeRewards> {
  const state = toQueryState(useRewardSummary(supabase, useSession().session?.user.id ?? null));
  if (state.status !== 'success') return state;
  const { stamps, points, availableCouponCount } = state.data;
  return {
    status: 'success',
    data: {
      stamps: { count: stamps.balance, goal: stamps.nextGoal ?? 0 },
      // The summary has no expiry date; the Reward tab's points screen shows it.
      points: {
        balance: points.balance,
        held: Math.max(points.balance - points.available, 0),
        available: points.available,
        nextExpiresAt: null,
      },
      couponCount: availableCouponCount,
    },
  };
}
