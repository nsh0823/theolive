import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isAppErrorCode,
  toAppErrorCode,
  type CouponPointTransactionRow,
  type PointTxKind,
} from '@theolive/types';
import { pointCodeInputSchema } from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Coupon Points for the customer app (RW-05..08, PAY-03). Separate from Olive Stamps and reward coupons: own
// tables, own RPCs, own query keys. Every number comes from the server; nothing is summed on the device.

type Db = Pick<TypedSupabaseClient, 'from'>;
type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

/** Newest ledger rows shown on the points history screen. */
export const POINT_LEDGER_LIMIT = 100;

export type PointSummaryView = {
  /** Points that can be spent: lots that have not ended. */
  balance: number;
  /** Points reserved by checkouts that are not paid yet. */
  held: number;
  /** `balance` minus `held`, never below 0. */
  available: number;
  /** When the soonest-ending lot ends, or `null` without points. */
  nextExpiresAt: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

export async function fetchPointSummary(client: Rpc): Promise<PointSummaryView> {
  const { data, error } = await client.rpc('get_my_point_summary');
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  return {
    balance: toNumber(body.balance),
    held: toNumber(body.held),
    available: toNumber(body.available),
    nextExpiresAt: typeof body.nextExpiresAt === 'string' ? body.nextExpiresAt : null,
  };
}

export type PointLedgerEntryView = {
  id: number;
  kind: PointTxKind;
  /** Signed won. */
  delta: number;
  label: string;
  createdAt: string;
  /** When the points of this row end. */
  lotExpiresAt: string;
  orderId: string | null;
};

export function toPointLedgerEntry(row: CouponPointTransactionRow): PointLedgerEntryView {
  return {
    id: row.id,
    kind: row.kind,
    delta: row.delta,
    label: row.label,
    createdAt: row.created_at,
    lotExpiresAt: row.lot_expires_at,
    orderId: row.order_id,
  };
}

export async function fetchPointLedger(
  client: Db,
  userId: string,
): Promise<PointLedgerEntryView[]> {
  const { data, error } = await client
    .from('coupon_point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(POINT_LEDGER_LIMIT);
  if (error) throw error;
  return data.map(toPointLedgerEntry);
}

export function usePointSummary(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.pointSummary(userId ?? ''),
    queryFn: () => fetchPointSummary(client),
    enabled: userId !== null,
  });
}

export function usePointLedger(client: TypedSupabaseClient, userId: string | null) {
  return useQuery({
    queryKey: queryKeys.rewards.pointLedger(userId ?? ''),
    queryFn: () => fetchPointLedger(client, userId ?? ''),
    enabled: userId !== null,
  });
}

// ---- Registering a code ----

export type RegisteredPointCode = {
  amount: number;
  /** Spendable balance after the registration. */
  balance: number;
  expiresAt: string;
};

/** A rejected entry: invalid, already used, expired, void or rate limited. */
export class PointCodeRejectedError extends AppError {
  /** For `TOO_MANY_ATTEMPTS`: seconds until another entry is accepted. */
  readonly retryAfterSeconds: number | null;

  constructor(code: AppError['code'], retryAfterSeconds: number | null) {
    super(code);
    this.name = 'PointCodeRejectedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * RW-05: the server normalizes the code, counts the attempt, locks the code and credits the points in one
 * transaction. A rejection is returned (so the failed attempt is stored) and turned into an error here.
 */
export async function registerPointCode(client: Rpc, input: string): Promise<RegisteredPointCode> {
  const parsed = pointCodeInputSchema.safeParse(input);
  if (!parsed.success) throw new AppError('CODE_INVALID');
  const { data, error } = await client.rpc('register_coupon_point_code', { p_code: parsed.data });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  if (body.status === 'REGISTERED') {
    return {
      amount: toNumber(body.amount),
      balance: toNumber(body.balance),
      expiresAt: String(body.expiresAt),
    };
  }
  const code = body.errorCode;
  if (!isAppErrorCode(code)) throw new AppError('INTERNAL');
  const retry = body.retryAfterSeconds;
  throw new PointCodeRejectedError(code, typeof retry === 'number' ? retry : null);
}

export function useRegisterPointCode(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => registerPointCode(client, code),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all }),
  });
}
