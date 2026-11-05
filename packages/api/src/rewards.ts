import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  toAppErrorCode,
  USER_COUPON_STATUS,
  type CouponRow,
  type StampTransactionRow,
  type UserCouponViewRow,
  type CouponBenefitType,
  type UserCouponStatus,
  type StampTxKind,
  type Temperature,
} from '@theolive/types';
import { stampExchangeSchema } from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Olive Stamps and reward coupons for the customer app (RW-01..04, PAY-02). Coupon Points live in points.ts;
// only the checkout quote below shows both, as separate fields.
// Everything here is read from, or sent to, the server; no amount is computed on the device.

type Db = Pick<TypedSupabaseClient, 'from'>;
type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

/** Newest ledger rows shown on the stamp history screen. */
export const STAMP_LEDGER_LIMIT = 100;

// ---- Stamps ----

/** The member's own balance (row-level security); no row yet means no stamps. */
export async function fetchStampBalance(client: Db, userId: string): Promise<number> {
  const { data, error } = await client
    .from('stamp_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export type StampLedgerEntryView = {
  id: number;
  kind: StampTxKind;
  /** Signed number of stamps. */
  delta: number;
  balanceAfter: number;
  label: string;
  createdAt: string;
  orderId: string | null;
};

export function toStampLedgerEntry(row: StampTransactionRow): StampLedgerEntryView {
  return {
    id: row.id,
    kind: row.kind,
    delta: row.delta,
    balanceAfter: row.balance_after,
    label: row.label,
    createdAt: row.created_at,
    orderId: row.order_id,
  };
}

export async function fetchStampLedger(
  client: Db,
  userId: string,
): Promise<StampLedgerEntryView[]> {
  const { data, error } = await client
    .from('stamp_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(STAMP_LEDGER_LIMIT);
  if (error) throw error;
  return data.map(toStampLedgerEntry);
}

export type CouponBenefit = {
  benefitType: CouponBenefitType;
  /** FIXED_AMOUNT: the won amount off. FREE_ITEM: the cap on the free unit price, `null` = no cap. */
  discountAmount: number | null;
};

export type StampExchangeOptionView = CouponBenefit & {
  id: string;
  title: string;
  requiredStamps: number;
  validDays: number;
};

export function toExchangeOption(row: CouponRow): StampExchangeOptionView {
  return {
    id: row.id,
    title: row.title,
    requiredStamps: row.required_stamps,
    validDays: row.valid_days,
    benefitType: row.benefit_type,
    discountAmount: row.discount_amount,
  };
}

/** Active exchange rules, cheapest first (customers cannot see inactive ones). */
export async function fetchExchangeOptions(client: Db): Promise<StampExchangeOptionView[]> {
  const { data, error } = await client
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .order('required_stamps', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data.map(toExchangeOption);
}

/**
 * HOME-04: the next goal is the smallest exchange cost above the balance; once every cost is reached it is the
 * largest one. `0` when no rule is active, which the UI shows as "no goal".
 */
export function nextStampGoal(balance: number, requiredStamps: readonly number[]): number {
  const sorted = [...requiredStamps].sort((a, b) => a - b);
  const next = sorted.find((cost) => cost > balance);
  return next ?? sorted[sorted.length - 1] ?? 0;
}

export function useStampBalance(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.stampBalance(userId ?? ''),
    queryFn: () => fetchStampBalance(client, userId ?? ''),
    enabled: userId !== null,
  });
}

export function useStampLedger(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.stampLedger(userId ?? ''),
    queryFn: () => fetchStampLedger(client, userId ?? ''),
    enabled: userId !== null,
  });
}

export function useStampExchangeOptions(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.rewards.exchangeOptions(),
    queryFn: () => fetchExchangeOptions(client),
  });
}

export type RedeemStampsInput = { couponId: string; clientRequestId: string };
export type RedeemStampsResult = { userCouponId: string; stampBalance: number; isReplay: boolean };

/** RW-02: the server checks the balance, deducts the stamps and issues the coupon in one transaction. */
export async function redeemStamps(
  client: Rpc,
  input: RedeemStampsInput,
): Promise<RedeemStampsResult> {
  const parsed = stampExchangeSchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const { data, error } = await client.rpc('redeem_stamps_for_coupon', {
    p_coupon_id: parsed.data.couponId,
    p_client_request_id: parsed.data.clientRequestId,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  return {
    userCouponId: String(body.userCouponId),
    stampBalance: Number(body.stampBalance),
    isReplay: body.isReplay === true,
  };
}

export function useRedeemStamps(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RedeemStampsInput) => redeemStamps(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all }),
  });
}

// ---- Coupons ----

/** `AVAILABLE`, `USED` and `EXPIRED` are what the wallet separates (RW-03); the server's display status decides. */
export type CouponWalletStatus = Extract<
  UserCouponStatus,
  | typeof USER_COUPON_STATUS.AVAILABLE
  | typeof USER_COUPON_STATUS.USED
  | typeof USER_COUPON_STATUS.EXPIRED
>;

export type CouponView = CouponBenefit & {
  id: string;
  title: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  status: CouponWalletStatus;
};

/** Reserved coupons are in an open checkout and VOID ones are gone: the wallet shows neither as usable. */
function toWalletStatus(status: UserCouponStatus): CouponWalletStatus {
  if (status === USER_COUPON_STATUS.USED) return USER_COUPON_STATUS.USED;
  if (status === USER_COUPON_STATUS.AVAILABLE || status === USER_COUPON_STATUS.RESERVED) {
    return USER_COUPON_STATUS.AVAILABLE;
  }
  return USER_COUPON_STATUS.EXPIRED;
}

export function toCouponView(row: UserCouponViewRow): CouponView | null {
  // Only the computed status can be missing in the generated view type.
  if (row.display_status === null) return null;
  return {
    id: row.id,
    title: row.title_snapshot,
    benefitType: row.benefit_type_snapshot,
    discountAmount: row.discount_amount_snapshot,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    status: toWalletStatus(row.display_status),
  };
}

/** Owned coupons, soonest-expiring first. */
export async function fetchMyCoupons(client: Db, userId: string): Promise<CouponView[]> {
  const { data, error } = await client
    .from('user_coupon_view')
    .select('*')
    .eq('user_id', userId)
    .order('expires_at', { ascending: true });
  if (error) throw error;
  return data.flatMap((row) => {
    const view = toCouponView(row);
    return view ? [view] : [];
  });
}

export function useMyCoupons(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.coupons(userId ?? ''),
    queryFn: () => fetchMyCoupons(client, userId ?? ''),
    enabled: userId !== null,
  });
}

// ---- Checkout quote (PAY-01, PAY-02) ----

export type CheckoutQuoteLine = {
  menuItemId: string;
  temperature: Temperature | null;
  quantity: number;
};

export type CheckoutQuote = {
  menuAmount: number;
  couponDiscount: number;
  /** What the server applied: the requested points limited by balance, total, coupon and the use rules. */
  pointsUsed: number;
  paidAmount: number;
  /** Ids of the caller's coupons that can be applied to these lines. */
  usableCouponIds: string[];
  /** Points the member can spend now (open checkouts already subtracted). */
  pointsAvailable: number;
  /** What "use all" would apply to this cart and coupon. */
  maxPointsUsable: number;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

/** The server prices the cart and the coupon; the app only shows the answer. */
export async function fetchCheckoutQuote(
  client: Rpc,
  lines: CheckoutQuoteLine[],
  userCouponId: string | null,
  pointsToUse = 0,
): Promise<CheckoutQuote> {
  const { data, error } = await client.rpc('quote_checkout', {
    p_lines: lines,
    p_user_coupon_id: userCouponId ?? undefined,
    p_points_to_use: pointsToUse,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  const usable: unknown = body.usableCouponIds;
  return {
    menuAmount: toNumber(body.menuAmount),
    couponDiscount: toNumber(body.couponDiscount),
    pointsUsed: toNumber(body.pointsUsed),
    paidAmount: toNumber(body.paidAmount),
    usableCouponIds: Array.isArray(usable) ? usable.map(String) : [],
    pointsAvailable: toNumber(body.pointsAvailable),
    maxPointsUsable: toNumber(body.maxPointsUsable),
  };
}

export function useCheckoutQuote(
  client: TypedSupabaseClient,
  lines: CheckoutQuoteLine[],
  userCouponId: string | null,
  pointsToUse = 0,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.rewards.quote({ lines, userCouponId, pointsToUse }),
    queryFn: () => fetchCheckoutQuote(client, lines, userCouponId, pointsToUse),
    enabled: enabled && lines.length > 0,
    // A quote is a preview; do not keep showing one for a cart that changed.
    staleTime: 0,
  });
}
