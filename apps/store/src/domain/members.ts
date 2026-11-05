import { toDateInputValue } from '@/lib/format';
import type { Order } from './models';
import { isSalesOrder } from './summaries';
import type {
  LoginProvider,
  Member,
  MemberStats,
  PointLedgerEntry,
  StampLedgerEntry,
} from './memberModels';

export const MEMBER_FILTER_ALL = 'ALL';

export type MemberFilters = {
  /** Matches nickname or the order number of any of the member's orders. Never email or phone. */
  query: string;
  provider: LoginProvider | typeof MEMBER_FILTER_ALL;
  /** `YYYY-MM-DD`, inclusive. Empty string means no bound. */
  joinedFrom: string;
  joinedTo: string;
};

export const EMPTY_MEMBER_FILTERS: MemberFilters = {
  query: '',
  provider: MEMBER_FILTER_ALL,
  joinedFrom: '',
  joinedTo: '',
};

export function hasActiveMemberFilters(filters: MemberFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.provider !== MEMBER_FILTER_ALL ||
    filters.joinedFrom !== '' ||
    filters.joinedTo !== ''
  );
}

export function ordersOfMember(orders: readonly Order[], memberId: string): Order[] {
  return orders.filter((order) => order.memberId === memberId);
}

/** Display-only totals; the server owns the real numbers. Spent counts paid, non-rejected orders. */
export function computeMemberStats(memberOrders: readonly Order[]): MemberStats {
  const sales = memberOrders.filter(isSalesOrder);
  const newest =
    memberOrders
      .map((order) => order.placedAt)
      .sort()
      .at(-1) ?? null;
  return {
    orderCount: sales.length,
    totalSpent: sales.reduce((sum, order) => sum + order.paidAmount, 0),
    lastOrderAt: newest,
  };
}

function matchesQuery(member: Member, memberOrders: readonly Order[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  if (member.nickname.toLowerCase().includes(needle)) return true;
  return memberOrders.some((order) => order.orderNumber.toLowerCase().includes(needle));
}

/** Newest members first. Pure. */
export function filterMembers(
  members: readonly Member[],
  orders: readonly Order[],
  filters: MemberFilters,
): Member[] {
  return members
    .filter((member) => matchesQuery(member, ordersOfMember(orders, member.id), filters.query))
    .filter(
      (member) => filters.provider === MEMBER_FILTER_ALL || member.provider === filters.provider,
    )
    .filter((member) => {
      const day = toDateInputValue(member.joinedAt);
      if (filters.joinedFrom !== '' && day < filters.joinedFrom) return false;
      if (filters.joinedTo !== '' && day > filters.joinedTo) return false;
      return true;
    })
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
}

/** Each asset has its own balance function on purpose: stamps and points are never summed together. */
export function stampBalance(entries: readonly StampLedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function pointBalance(entries: readonly PointLedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}
