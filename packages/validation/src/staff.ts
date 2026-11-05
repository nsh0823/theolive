import { z } from 'zod';

import { STAFF_NAME_MAX_LENGTH, STAFF_NAME_MIN_LENGTH } from './limits';

export const staffRoleSchema = z.enum(['ADMIN', 'STAFF']);
export const staffPermissionSchema = z.enum(['PROCESS_ORDERS', 'MANAGE_OPERATIONS']);

const staffNameSchema = z
  .string()
  .trim()
  .min(STAFF_NAME_MIN_LENGTH, '이름을 입력해 주세요.')
  .max(STAFF_NAME_MAX_LENGTH, `이름은 ${STAFF_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`);

const permissionsSchema = z
  .array(staffPermissionSchema)
  .min(1, '권한을 하나 이상 선택해 주세요.')
  .refine((values) => new Set(values).size === values.length, '권한이 중복되었어요.');

export const staffInviteSchema = z.object({
  email: z.string().trim().pipe(z.email('이메일 형식을 확인해 주세요.')),
  displayName: staffNameSchema,
  role: staffRoleSchema,
  permissions: permissionsSchema,
});

export const staffUpdateSchema = z.object({
  userId: z.uuid(),
  displayName: staffNameSchema,
  role: staffRoleSchema,
  permissions: permissionsSchema,
  isActive: z.boolean(),
});

export type StaffInviteInput = z.infer<typeof staffInviteSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
