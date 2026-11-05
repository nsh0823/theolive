import { z } from 'zod';

import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, PASSWORD_MIN_LENGTH } from './limits';

export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, '닉네임을 입력해 주세요.')
  .max(NICKNAME_MAX_LENGTH, `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`);

/** Email/password sign-in. Local/dev only for customers (OQ-3); the real sign-in method for staff (OQ-4). */
export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email('이메일 형식을 확인해 주세요.')),
  password: z.string().min(PASSWORD_MIN_LENGTH, `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이에요.`),
});

export type SignInInput = z.infer<typeof signInSchema>;
