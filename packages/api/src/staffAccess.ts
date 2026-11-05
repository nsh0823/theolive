import {
  STAFF_PERMISSION,
  STAFF_ROLE,
  type StaffPermission,
  type StaffRole,
} from '@theolive/types';

/** Role of a signed-in staff account. Absent for customers. UI gating only; RLS is the boundary. */
export type StaffAccess = {
  role: StaffRole;
  /** Effective permissions: an ADMIN always has all of them. */
  permissions: readonly StaffPermission[];
  isActive: boolean;
};

const ALL_PERMISSIONS: readonly StaffPermission[] = Object.values(STAFF_PERMISSION);

type RoleRow = { role: StaffRole; permissions: StaffPermission[]; is_active: boolean };

export function toStaffAccess(row: RoleRow): StaffAccess {
  return {
    role: row.role,
    permissions: row.role === STAFF_ROLE.ADMIN ? ALL_PERMISSIONS : row.permissions,
    isActive: row.is_active,
  };
}

export function canProcessOrders(access: StaffAccess | null): boolean {
  return (
    access !== null &&
    access.isActive &&
    access.permissions.includes(STAFF_PERMISSION.PROCESS_ORDERS)
  );
}

export function canManageOperations(access: StaffAccess | null): boolean {
  return (
    access !== null &&
    access.isActive &&
    access.permissions.includes(STAFF_PERMISSION.MANAGE_OPERATIONS)
  );
}

export function isAdmin(access: StaffAccess | null): boolean {
  return access !== null && access.isActive && access.role === STAFF_ROLE.ADMIN;
}
