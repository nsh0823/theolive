import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toAppErrorCode, type CouponPointPolicyRow } from '@theolive/types';
import {
  pointIssueSchema,
  pointPolicySchema,
  type PointIssueInput,
  type PointPolicyInput,
} from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Store Admin: Coupon Points policy, code batches, code list and void (SA-08). The RPCs check that the caller is an
// admin; the schemas here only give the form quick feedback. Codes are returned in full only once, when issued.

type Db = Pick<TypedSupabaseClient, 'from'>;
type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

/** `EXHAUSTED` = registered with nothing left. The server derives it; it is not a stored status. */
export const POINT_CODE_DISPLAY_STATUS = {
  UNUSED: 'UNUSED',
  REGISTERED: 'REGISTERED',
  EXHAUSTED: 'EXHAUSTED',
  EXPIRED: 'EXPIRED',
  VOID: 'VOID',
} as const;
export type PointCodeDisplayStatus =
  (typeof POINT_CODE_DISPLAY_STATUS)[keyof typeof POINT_CODE_DISPLAY_STATUS];

function toDisplayStatus(value: unknown): PointCodeDisplayStatus {
  const status = Object.values(POINT_CODE_DISPLAY_STATUS).find((known) => known === value);
  if (!status) throw new AppError('INTERNAL');
  return status;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

// ---- Policy ----

export type PointPolicyView = {
  minUseAmount: number;
  useUnit: number;
  /** `null` = no cap per order. */
  maxUsePerOrder: number | null;
  registrationAttemptLimit: number;
  registrationAttemptWindowMinutes: number;
};

export function toPointPolicyView(row: CouponPointPolicyRow): PointPolicyView {
  return {
    minUseAmount: row.min_use_amount,
    useUnit: row.use_unit,
    maxUsePerOrder: row.max_use_per_order,
    registrationAttemptLimit: row.registration_attempt_limit,
    registrationAttemptWindowMinutes: row.registration_attempt_window_minutes,
  };
}

export async function fetchPointPolicy(client: Db): Promise<PointPolicyView> {
  const { data, error } = await client.from('coupon_point_policy').select('*').eq('id', 1).single();
  if (error) throw error;
  return toPointPolicyView(data);
}

export async function savePointPolicy(client: Db, input: PointPolicyInput): Promise<void> {
  const parsed = pointPolicySchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const { error } = await client
    .from('coupon_point_policy')
    .update({
      min_use_amount: parsed.data.minUseAmount,
      use_unit: parsed.data.useUnit,
      max_use_per_order: parsed.data.maxUsePerOrder,
    })
    .eq('id', 1);
  if (error) throw new AppError(toAppErrorCode(error));
}

export function usePointPolicy(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.pointsAdmin.policy(),
    queryFn: () => fetchPointPolicy(client),
  });
}

export function useSavePointPolicy(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PointPolicyInput) => savePointPolicy(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.pointsAdmin.all }),
  });
}

// ---- Codes ----

export type PointCodeView = {
  id: string;
  /** Only the last four characters are readable after the issue screen. */
  maskedCode: string;
  amount: number;
  /** What a customer could still spend from this code. */
  remaining: number;
  status: PointCodeDisplayStatus;
  issuedAt: string;
  expiresAt: string;
  registeredAt: string | null;
  memo: string;
};

export type PointTotalsView = { issued: number; used: number; remaining: number };

export type PointCodeListView = {
  codes: PointCodeView[];
  /** How many codes match the filter and search, for paging. */
  matching: number;
  /** Always over every code, whatever the filter. */
  totals: PointTotalsView;
};

export type PointCodeFilters = {
  status: PointCodeDisplayStatus | null;
  search: string;
  limit: number;
  offset: number;
};

/** Page size of the admin list (the server caps it at 200). */
export const POINT_CODE_PAGE_SIZE = 100;

function toCodeView(value: unknown): PointCodeView {
  const row = asRecord(value);
  return {
    id: String(row.id),
    maskedCode: String(row.maskedCode),
    amount: toNumber(row.amount),
    remaining: toNumber(row.remaining),
    status: toDisplayStatus(row.status),
    issuedAt: String(row.issuedAt),
    expiresAt: String(row.expiresAt),
    registeredAt: typeof row.registeredAt === 'string' ? row.registeredAt : null,
    memo: typeof row.memo === 'string' ? row.memo : '',
  };
}

export async function fetchPointCodes(
  client: Rpc,
  filters: PointCodeFilters,
): Promise<PointCodeListView> {
  const { data, error } = await client.rpc('admin_list_point_codes', {
    p_status: filters.status ?? undefined,
    p_search: filters.search.trim() === '' ? undefined : filters.search.trim(),
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  const totals = asRecord(body.totals);
  const codes: unknown = body.codes;
  return {
    codes: Array.isArray(codes) ? codes.map(toCodeView) : [],
    matching: toNumber(body.matching),
    totals: {
      issued: toNumber(totals.issued),
      used: toNumber(totals.used),
      remaining: toNumber(totals.remaining),
    },
  };
}

export function usePointCodes(client: TypedSupabaseClient, filters: PointCodeFilters) {
  return useQuery({
    queryKey: queryKeys.pointsAdmin.codes(filters),
    queryFn: () => fetchPointCodes(client, filters),
  });
}

export type IssuedPointCode = { id: string; code: string };

/** The only time full codes are returned. The caller must show or copy them now. */
export async function issuePointCodes(
  client: Rpc,
  input: PointIssueInput,
): Promise<IssuedPointCode[]> {
  const parsed = pointIssueSchema.safeParse(input);
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const { data, error } = await client.rpc('admin_issue_point_codes', {
    p_amount: parsed.data.amount,
    p_quantity: parsed.data.quantity,
    p_expires_on: parsed.data.expiresOn,
    p_memo: parsed.data.memo,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const codes: unknown = asRecord(data).codes;
  if (!Array.isArray(codes)) throw new AppError('INTERNAL');
  return codes.map((value) => {
    const row = asRecord(value);
    return { id: String(row.id), code: String(row.code) };
  });
}

/** Only an unregistered code can be voided (OQ-31). */
export async function voidPointCode(client: Rpc, codeId: string): Promise<void> {
  const { error } = await client.rpc('admin_void_point_code', { p_code_id: codeId });
  if (error) throw new AppError(toAppErrorCode(error));
}

export function useIssuePointCodes(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PointIssueInput) => issuePointCodes(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.pointsAdmin.all }),
  });
}

export function useVoidPointCode(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codeId: string) => voidPointCode(client, codeId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.pointsAdmin.all }),
  });
}
