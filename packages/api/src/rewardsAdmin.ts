import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  toAppErrorCode,
  USER_COUPON_STATUS,
  type CouponBenefitType,
  type CouponRow,
  type StampEarnMode,
  type StampPolicyRow,
  type UserCouponStatus,
} from '@theolive/types';
import {
  exchangeRuleSchema,
  stampPolicySchema,
  type ExchangeRuleInput,
  type StampPolicyInput,
} from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Store Admin: stamp policy, exchange rules and issued coupons (SA-07). Row-level security and the RPCs decide
// who may write; the schemas here only give the form quick feedback.

type Db = Pick<TypedSupabaseClient, 'from'>;
type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

export type StampPolicyView = {
  id: string;
  earnMode: StampEarnMode;
  /** PER_ORDER: stamps per completed order; `null` for PER_AMOUNT. */
  stampsPerOrder: number | null;
  /** PER_AMOUNT: won per stamp; `null` for PER_ORDER. */
  amountPerStamp: number | null;
  effectiveFrom: string;
};

export function toStampPolicyView(row: StampPolicyRow): StampPolicyView {
  return {
    id: row.id,
    earnMode: row.earn_mode,
    stampsPerOrder: row.stamps_per_order,
    amountPerStamp: row.amount_per_stamp,
    effectiveFrom: row.effective_from,
  };
}

/** The policy in force: the newest one whose start time has passed. */
export async function fetchStampPolicy(client: Db): Promise<StampPolicyView | null> {
  const { data, error } = await client
    .from('stamp_policies')
    .select('*')
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toStampPolicyView(data) : null;
}

/** Saving never edits history: the server appends a new policy that applies to orders paid afterwards. */
export async function setStampPolicy(client: Rpc, input: StampPolicyInput): Promise<void> {
  const parsed = stampPolicySchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const policy = parsed.data;
  const { error } = await client.rpc('admin_set_stamp_policy', {
    p_earn_mode: policy.earnMode,
    p_stamps_per_order: policy.earnMode === 'PER_ORDER' ? policy.stampsPerOrder : undefined,
    p_amount_per_stamp: policy.earnMode === 'PER_AMOUNT' ? policy.amountPerStamp : undefined,
    p_earn_basis: 'MENU_AMOUNT',
  });
  if (error) throw new AppError(toAppErrorCode(error));
}

export function useStampPolicy(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.rewardsAdmin.policy(),
    queryFn: () => fetchStampPolicy(client),
  });
}

export function useSetStampPolicy(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StampPolicyInput) => setStampPolicy(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewardsAdmin.all }),
  });
}

// ---- Exchange rules (coupon definitions) ----

export type CouponRuleView = {
  id: string;
  title: string;
  requiredStamps: number;
  validDays: number;
  benefitType: CouponBenefitType;
  discountAmount: number | null;
  eligibleCategoryIds: string[];
  eligibleMenuItemIds: string[];
  isActive: boolean;
};

export function toCouponRuleView(row: CouponRow): CouponRuleView {
  return {
    id: row.id,
    title: row.title,
    requiredStamps: row.required_stamps,
    validDays: row.valid_days,
    benefitType: row.benefit_type,
    discountAmount: row.discount_amount,
    eligibleCategoryIds: row.eligible_category_ids,
    eligibleMenuItemIds: row.eligible_menu_item_ids,
    isActive: row.is_active,
  };
}

export async function fetchCouponRules(client: Db): Promise<CouponRuleView[]> {
  const { data, error } = await client
    .from('coupons')
    .select('*')
    .order('required_stamps', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toCouponRuleView);
}

/** Creates a rule, or edits one when `id` is given. Eligible items stay as they are on an edit. Issued coupons keep their snapshot. */
export async function saveCouponRule(
  client: Db,
  input: ExchangeRuleInput & { id: string | null },
): Promise<void> {
  const { id, ...fields } = input;
  const parsed = exchangeRuleSchema.safeParse(fields);
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const rule = parsed.data;
  const values = {
    title: rule.title,
    required_stamps: rule.requiredStamps,
    valid_days: rule.validDays,
    benefit_type: rule.benefitType,
    discount_amount: rule.discountAmount,
  };
  const { error } =
    id === null
      ? await client.from('coupons').insert(values)
      : await client.from('coupons').update(values).eq('id', id);
  if (error) throw new AppError(toAppErrorCode(error));
}

/** Rules are never deleted (issued coupons point at them); a deactivated rule just stops being offered. */
export async function setCouponRuleActive(
  client: Db,
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await client.from('coupons').update({ is_active: isActive }).eq('id', id);
  if (error) throw new AppError(toAppErrorCode(error));
}

export function useCouponRules(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.rewardsAdmin.rules(),
    queryFn: () => fetchCouponRules(client),
  });
}

export function useSaveCouponRule(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExchangeRuleInput & { id: string | null }) => saveCouponRule(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewardsAdmin.all }),
  });
}

export function useSetCouponRuleActive(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      setCouponRuleActive(client, input.id, input.isActive),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewardsAdmin.all }),
  });
}

// ---- Overview and issued coupons ----

export type StampOverviewView = {
  earnedThisMonth: number;
  exchangedCoupons: number;
  outstandingStamps: number;
};

export async function fetchStampOverview(client: Rpc): Promise<StampOverviewView> {
  const { data, error } = await client.rpc('admin_stamp_overview');
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  return {
    earnedThisMonth: Number(body.earnedThisMonth),
    exchangedCoupons: Number(body.exchangedCoupons),
    outstandingStamps: Number(body.outstandingStamps),
  };
}

export function useStampOverview(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.rewardsAdmin.overview(),
    queryFn: () => fetchStampOverview(client),
  });
}

export type IssuedCouponView = {
  id: string;
  title: string;
  issuedAt: string;
  expiresAt: string;
  /** AVAILABLE, USED or EXPIRED (a coupon in an open checkout counts as available). */
  status: UserCouponStatus;
};

/** Number of newest issued coupons the admin list shows. */
export const ISSUED_COUPON_LIMIT = 100;

export async function fetchIssuedCoupons(client: Db): Promise<IssuedCouponView[]> {
  const { data, error } = await client
    .from('user_coupon_view')
    .select('*')
    .order('issued_at', { ascending: false })
    .limit(ISSUED_COUPON_LIMIT);
  if (error) throw error;
  return data.flatMap((row) => {
    if (row.display_status === null) return [];
    return [
      {
        id: row.id,
        title: row.title_snapshot,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        status:
          row.display_status === USER_COUPON_STATUS.RESERVED
            ? USER_COUPON_STATUS.AVAILABLE
            : row.display_status,
      },
    ];
  });
}

export function useIssuedCoupons(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.rewardsAdmin.issued(),
    queryFn: () => fetchIssuedCoupons(client),
  });
}
