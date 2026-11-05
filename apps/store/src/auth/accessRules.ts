import { canProcessOrders, isAdmin, type StaffAccess } from '@theolive/api';

/** What a route needs. UX gating only: RLS and RPC checks on the server are the security boundary. */
export const ACCESS_RULE = { PROCESS_ORDERS: 'PROCESS_ORDERS', ADMIN: 'ADMIN' } as const;
export type AccessRule = (typeof ACCESS_RULE)[keyof typeof ACCESS_RULE];

export const AUTH_STATUS = {
  LOADING: 'loading',
  SIGNED_OUT: 'signed-out',
  ERROR: 'error',
  SIGNED_IN: 'signed-in',
} as const;

export type AuthState =
  | { status: typeof AUTH_STATUS.LOADING }
  | { status: typeof AUTH_STATUS.SIGNED_OUT }
  | { status: typeof AUTH_STATUS.ERROR }
  | {
      status: typeof AUTH_STATUS.SIGNED_IN;
      userId: string;
      email: string | null;
      displayName: string;
      /** `null` for a customer account (no staff row). */
      access: StaffAccess | null;
    };

export const ROUTE_DECISION = {
  WAIT: 'wait',
  LOGIN: 'login',
  ERROR: 'error',
  ALLOW: 'allow',
  DENY: 'deny',
} as const;
export type RouteDecision = (typeof ROUTE_DECISION)[keyof typeof ROUTE_DECISION];

const RULE_CHECK: Record<AccessRule, (access: StaffAccess | null) => boolean> = {
  PROCESS_ORDERS: canProcessOrders,
  ADMIN: isAdmin,
};

export function decideRoute(state: AuthState, rule: AccessRule): RouteDecision {
  switch (state.status) {
    case AUTH_STATUS.LOADING:
      return ROUTE_DECISION.WAIT;
    case AUTH_STATUS.SIGNED_OUT:
      return ROUTE_DECISION.LOGIN;
    case AUTH_STATUS.ERROR:
      return ROUTE_DECISION.ERROR;
    case AUTH_STATUS.SIGNED_IN:
      return RULE_CHECK[rule](state.access) ? ROUTE_DECISION.ALLOW : ROUTE_DECISION.DENY;
  }
}
