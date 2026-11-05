import { describe, expect, it } from 'vitest';
import { toStaffAccess } from '@theolive/api';
import { STAFF_PERMISSION, STAFF_ROLE } from '@theolive/types';
import {
  ACCESS_RULE,
  AUTH_STATUS,
  ROUTE_DECISION,
  decideRoute,
  type AuthState,
} from './accessRules';

function signedIn(access: ReturnType<typeof toStaffAccess> | null): AuthState {
  return { status: AUTH_STATUS.SIGNED_IN, userId: 'u', email: null, displayName: 'n', access };
}

const admin = toStaffAccess({ role: STAFF_ROLE.ADMIN, permissions: [], is_active: true });
const barista = toStaffAccess({
  role: STAFF_ROLE.STAFF,
  permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
  is_active: true,
});
const opsOnly = toStaffAccess({
  role: STAFF_ROLE.STAFF,
  permissions: [STAFF_PERMISSION.MANAGE_OPERATIONS],
  is_active: true,
});
const inactive = toStaffAccess({ role: STAFF_ROLE.ADMIN, permissions: [], is_active: false });

describe('decideRoute', () => {
  it('waits while loading and sends signed-out users to login', () => {
    expect(decideRoute({ status: AUTH_STATUS.LOADING }, ACCESS_RULE.ADMIN)).toBe(
      ROUTE_DECISION.WAIT,
    );
    expect(decideRoute({ status: AUTH_STATUS.SIGNED_OUT }, ACCESS_RULE.PROCESS_ORDERS)).toBe(
      ROUTE_DECISION.LOGIN,
    );
  });

  it('surfaces role-loading errors instead of guessing', () => {
    expect(decideRoute({ status: AUTH_STATUS.ERROR }, ACCESS_RULE.ADMIN)).toBe(
      ROUTE_DECISION.ERROR,
    );
  });

  it('/orders needs PROCESS_ORDERS (admins included)', () => {
    expect(decideRoute(signedIn(barista), ACCESS_RULE.PROCESS_ORDERS)).toBe(ROUTE_DECISION.ALLOW);
    expect(decideRoute(signedIn(admin), ACCESS_RULE.PROCESS_ORDERS)).toBe(ROUTE_DECISION.ALLOW);
    expect(decideRoute(signedIn(opsOnly), ACCESS_RULE.PROCESS_ORDERS)).toBe(ROUTE_DECISION.DENY);
  });

  it('/admin needs ADMIN: staff and customers are denied', () => {
    expect(decideRoute(signedIn(admin), ACCESS_RULE.ADMIN)).toBe(ROUTE_DECISION.ALLOW);
    expect(decideRoute(signedIn(barista), ACCESS_RULE.ADMIN)).toBe(ROUTE_DECISION.DENY);
    expect(decideRoute(signedIn(null), ACCESS_RULE.ADMIN)).toBe(ROUTE_DECISION.DENY);
  });

  it('denies inactive accounts everywhere', () => {
    expect(decideRoute(signedIn(inactive), ACCESS_RULE.ADMIN)).toBe(ROUTE_DECISION.DENY);
    expect(decideRoute(signedIn(inactive), ACCESS_RULE.PROCESS_ORDERS)).toBe(ROUTE_DECISION.DENY);
  });

  it('denies customers on /orders', () => {
    expect(decideRoute(signedIn(null), ACCESS_RULE.PROCESS_ORDERS)).toBe(ROUTE_DECISION.DENY);
  });
});
