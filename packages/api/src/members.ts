import { useQuery } from '@tanstack/react-query';
import { toAppErrorCode } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord } from './statusGuards';

// Store Admin 회원관리 (SA-12), view only and admin only. The database masks email and phone and never returns
// the raw values, so nothing here can leak them; Olive Stamps and Coupon Points come back as two separate ledgers.

type Rpc = Pick<TypedSupabaseClient, 'rpc'>;

export type MemberView = {
  id: string;
  nickname: string;
  /** Already masked by the server, e.g. `hong***@gmail.com`; `null` when the provider shared no email. */
  maskedEmail: string | null;
  /** Already masked by the server, e.g. `010-****-5678`; `null` when no phone is on file. */
  maskedPhone: string | null;
  /** Uppercase login provider: KAKAO, NAVER, GOOGLE, APPLE, or EMAIL (local/dev). */
  provider: string;
  joinedAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

export type MemberLedgerEntryView = {
  id: number;
  kind: string;
  label: string;
  /** Signed: stamps for the stamp ledger, won for the point ledger. */
  delta: number;
  balanceAfter: number;
  createdAt: string;
};

export type MemberOrderView = {
  id: string;
  orderNumber: string | null;
  status: string;
  paymentStatus: string;
  paidAmount: number;
  placedAt: string;
};

export type MemberDetailView = MemberView & {
  stampBalance: number;
  pointBalance: number;
  stampLedger: MemberLedgerEntryView[];
  pointLedger: MemberLedgerEntryView[];
  orders: MemberOrderView[];
};

export type MemberFilters = { search: string; limit: number; offset: number };

/** Page size of the member list (the server caps it at 100). */
export const MEMBER_PAGE_SIZE = 50;

export type MemberListView = { members: MemberView[]; total: number };

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('INTERNAL');
  return n;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function toMemberView(value: unknown): MemberView {
  const row = asRecord(value);
  return {
    id: String(row.id),
    nickname: String(row.nickname),
    maskedEmail: toNullableString(row.maskedEmail),
    maskedPhone: toNullableString(row.maskedPhone),
    provider: String(row.provider),
    joinedAt: String(row.joinedAt),
    orderCount: toNumber(row.orderCount),
    totalSpent: toNumber(row.totalSpent),
    lastOrderAt: toNullableString(row.lastOrderAt),
  };
}

function toLedgerEntry(value: unknown): MemberLedgerEntryView {
  const row = asRecord(value);
  return {
    id: toNumber(row.id),
    kind: String(row.kind),
    label: String(row.label),
    delta: toNumber(row.delta),
    balanceAfter: toNumber(row.balanceAfter),
    createdAt: String(row.createdAt),
  };
}

function toMemberOrder(value: unknown): MemberOrderView {
  const row = asRecord(value);
  return {
    id: String(row.id),
    orderNumber: toNullableString(row.orderNumber),
    status: String(row.status),
    paymentStatus: String(row.paymentStatus),
    paidAmount: toNumber(row.paidAmount),
    placedAt: String(row.placedAt),
  };
}

function toList<T>(value: unknown, map: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(map) : [];
}

export async function fetchMembers(client: Rpc, filters: MemberFilters): Promise<MemberListView> {
  const search = filters.search.trim();
  const { data, error } = await client.rpc('admin_list_members', {
    p_search: search === '' ? undefined : search,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  return { members: toList(body.items, toMemberView), total: toNumber(body.total) };
}

export async function fetchMember(client: Rpc, id: string): Promise<MemberDetailView> {
  const { data, error } = await client.rpc('admin_get_member', { p_member_id: id });
  if (error) throw new AppError(toAppErrorCode(error));
  const body = asRecord(data);
  return {
    ...toMemberView(body),
    stampBalance: toNumber(body.stampBalance),
    pointBalance: toNumber(body.pointBalance),
    stampLedger: toList(body.stampLedger, toLedgerEntry),
    pointLedger: toList(body.pointLedger, toLedgerEntry),
    orders: toList(body.orders, toMemberOrder),
  };
}

export function useMembers(client: TypedSupabaseClient, filters: MemberFilters) {
  return useQuery({
    queryKey: queryKeys.members.list(filters),
    queryFn: () => fetchMembers(client, filters),
  });
}

export function useMember(client: TypedSupabaseClient, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members.detail(id ?? ''),
    queryFn: () => fetchMember(client, id ?? ''),
    enabled: Boolean(id),
  });
}
