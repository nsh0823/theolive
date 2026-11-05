/**
 * Placeholder mutations. They only resolve; they never change balances, orders, or
 * prices. Replace each with a TanStack Query mutation backed by a server-verified
 * Edge Function (payments, exchange, code registration, account deletion).
 */
import type { PointCodeResult } from '@/models';

const FIXTURE_ORDER_ID = 'o1';

export async function submitFixtureOrder(): Promise<{ orderId: string }> {
  return { orderId: FIXTURE_ORDER_ID };
}

export async function requestStampExchange(optionId: string): Promise<{ optionId: string }> {
  return { optionId };
}

export async function registerPointCode(code: string): Promise<PointCodeResult> {
  return code.length > 0 ? { status: 'registered' } : { status: 'invalid' };
}

export async function requestAccountDeletion(): Promise<void> {}
