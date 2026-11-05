import { fetchMyStaffAccess, type TypedSupabaseClient } from '@theolive/api';

export const SESSION_VERDICT = {
  CUSTOMER: 'CUSTOMER',
  STAFF_REJECTED: 'STAFF_REJECTED',
  UNVERIFIED: 'UNVERIFIED',
} as const;
export type SessionVerdict = (typeof SESSION_VERDICT)[keyof typeof SESSION_VERDICT];

/**
 * Staff and admin accounts are separate from customer accounts (OQ-5) and may not use the customer app.
 * If the role cannot be read (network), the session is kept: RLS still protects staff data, and the
 * check runs again on the next session change.
 */
export async function classifySession(
  client: Pick<TypedSupabaseClient, 'rpc'>,
): Promise<SessionVerdict> {
  try {
    const access = await fetchMyStaffAccess(client);
    return access ? SESSION_VERDICT.STAFF_REJECTED : SESSION_VERDICT.CUSTOMER;
  } catch (error) {
    console.error('Could not verify the account type', error);
    return SESSION_VERDICT.UNVERIFIED;
  }
}
