import {
  usePointLedger,
  usePointSummary,
  useRegisterPointCode,
  type PointLedgerEntryView,
} from '@theolive/api';

import { useSession } from '@/hooks/useAuth';
import { formatCouponExpiry, formatKstDate } from '@/lib/format';
import { toQueryState, type QueryState } from '@/lib/queryState';
import type { LedgerEntry, LedgerKind, PointSummary } from '@/models';
import { supabase } from '@/services/supabase';

// Coupon Points (RW-05..08). Own hooks, own query keys: nothing here touches stamps or reward coupons.

function useUserId(): string | null {
  return useSession().session?.user.id ?? null;
}

const LEDGER_KIND: Record<PointLedgerEntryView['kind'], LedgerKind> = {
  REGISTER: 'EARN',
  USE: 'USE',
  REFUND_RESTORE: 'CANCEL',
  EXPIRE: 'EXPIRE',
  FORFEIT: 'EXPIRE',
  ADJUST: 'EARN',
};

/** Spendable balance, what open checkouts hold, and what is left (RW-06, HOME-04). */
export function usePointsQuery(): QueryState<PointSummary> {
  return toQueryState(usePointSummary(supabase, useUserId()));
}

export function usePointLedgerQuery(): QueryState<LedgerEntry[]> {
  const state = toQueryState(usePointLedger(supabase, useUserId()));
  if (state.status !== 'success') return state;
  return {
    status: 'success',
    data: state.data.map((entry) => ({
      id: String(entry.id),
      kind: LEDGER_KIND[entry.kind],
      label: entry.label,
      amount: entry.delta,
      at: formatKstDate(entry.createdAt),
      // The end date matters while the points can still be spent or restored.
      note: entry.delta > 0 ? `유효기간 ${formatCouponExpiry(entry.lotExpiresAt)}까지` : undefined,
    })),
  };
}

export const useRegisterPointCodeMutation = () => useRegisterPointCode(supabase);
