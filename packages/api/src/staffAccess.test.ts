import { describe, expect, it } from 'vitest';
import { STAFF_PERMISSION, STAFF_ROLE } from '@theolive/types';

import { canManageOperations, canProcessOrders, isAdmin, toStaffAccess } from './staffAccess';

const barista = toStaffAccess({
  role: STAFF_ROLE.STAFF,
  permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
  is_active: true,
});

describe('staff access', () => {
  it('gives an admin every permission regardless of the stored list', () => {
    const admin = toStaffAccess({ role: STAFF_ROLE.ADMIN, permissions: [], is_active: true });
    expect(canProcessOrders(admin)).toBe(true);
    expect(canManageOperations(admin)).toBe(true);
    expect(isAdmin(admin)).toBe(true);
  });

  it('limits staff to the stored permissions and never makes them admin', () => {
    expect(canProcessOrders(barista)).toBe(true);
    expect(canManageOperations(barista)).toBe(false);
    expect(isAdmin(barista)).toBe(false);
  });

  it('denies everything to inactive staff', () => {
    const inactive = toStaffAccess({
      role: STAFF_ROLE.ADMIN,
      permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
      is_active: false,
    });
    expect(canProcessOrders(inactive)).toBe(false);
    expect(canManageOperations(inactive)).toBe(false);
    expect(isAdmin(inactive)).toBe(false);
  });

  it('denies everything to customers (no staff row)', () => {
    expect(canProcessOrders(null)).toBe(false);
    expect(canManageOperations(null)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
