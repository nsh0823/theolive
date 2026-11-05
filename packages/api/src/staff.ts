import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StaffPermission, StaffRole } from '@theolive/types';
import { toAppErrorCode } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError, parseFunctionError } from './functionErrors';
import { queryKeys } from './query-keys';
import { toStaffAccess, type StaffAccess } from './staffAccess';

/** Staff row as shown in Store Admin 직원 관리. */
export type StaffListItem = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  permissions: StaffPermission[];
};

export type StaffInviteInput = {
  email: string;
  displayName: string;
  role: StaffRole;
  permissions: StaffPermission[];
};

export type StaffUpdateInput = {
  userId: string;
  displayName: string;
  role: StaffRole;
  permissions: StaffPermission[];
  isActive: boolean;
};

/** Returns the caller's staff role, or null for customers. Route gating only; RLS is the boundary. */
export async function fetchMyStaffAccess(
  client: Pick<TypedSupabaseClient, 'rpc'>,
): Promise<StaffAccess | null> {
  const { data, error } = await client.rpc('get_my_staff_role');
  if (error) throw error;
  const row = data[0];
  return row ? toStaffAccess(row) : null;
}

export function useStaffAccess(client: TypedSupabaseClient, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.staff.myRole(userId ?? ''),
    queryFn: () => fetchMyStaffAccess(client),
    enabled: Boolean(userId),
  });
}

export async function fetchStaffList(
  client: Pick<TypedSupabaseClient, 'rpc'>,
): Promise<StaffListItem[]> {
  const { data, error } = await client.rpc('admin_list_staff');
  if (error) throw new AppError(toAppErrorCode(error));
  return data.map((row) => ({
    id: row.user_id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    permissions: row.permissions,
  }));
}

export function useStaffList(client: TypedSupabaseClient) {
  return useQuery({ queryKey: queryKeys.staff.list(), queryFn: () => fetchStaffList(client) });
}

export async function inviteStaff(
  client: TypedSupabaseClient,
  input: StaffInviteInput,
): Promise<{ userId: string }> {
  const { data, error } = await client.functions.invoke<{ userId: string }>('admin-staff', {
    body: { action: 'INVITE', ...input },
  });
  if (error) throw new AppError(await parseFunctionError(error));
  if (!data) throw new AppError(toAppErrorCode(null));
  return data;
}

export function useInviteStaff(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInviteInput) => inviteStaff(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.list() }),
  });
}

export async function updateStaff(
  client: Pick<TypedSupabaseClient, 'rpc'>,
  input: StaffUpdateInput,
): Promise<void> {
  const { error } = await client.rpc('admin_update_staff', {
    p_user_id: input.userId,
    p_role: input.role,
    p_permissions: input.permissions,
    p_display_name: input.displayName,
    p_is_active: input.isActive,
  });
  if (error) throw new AppError(toAppErrorCode(error));
}

export function useUpdateStaff(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffUpdateInput) => updateStaff(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all }),
  });
}
