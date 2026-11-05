import { useQuery } from '@tanstack/react-query';
import { toAppErrorCode } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// HOME-04: both balances and the coupon count in one server call. Olive Stamps and Coupon Points stay separate
// fields; nothing is added up or recomputed on the device.

type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

export type RewardSummaryView = {
  stamps: {
    balance: number;
    /** The next requirement to work towards (smallest above the balance, else the largest); `null` without rewards. */
    nextGoal: number | null;
  };
  points: { balance: number; available: number };
  availableCouponCount: number;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

export async function fetchRewardSummary(client: Rpc): Promise<RewardSummaryView> {
  const { data, error } = await client.rpc('get_my_reward_summary');
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  const stamps = asRecord(body.stamps);
  const points = asRecord(body.points);
  return {
    stamps: {
      balance: toNumber(stamps.balance),
      nextGoal:
        stamps.nextGoal === null || stamps.nextGoal === undefined
          ? null
          : toNumber(stamps.nextGoal),
    },
    points: { balance: toNumber(points.balance), available: toNumber(points.available) },
    availableCouponCount: toNumber(body.availableCouponCount),
  };
}

export function useRewardSummary(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.summary(userId ?? ''),
    queryFn: () => fetchRewardSummary(client),
    enabled: userId !== null,
  });
}
