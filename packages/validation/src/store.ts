import { z } from 'zod';

import {
  STORE_ADDRESS_MAX_LENGTH,
  STORE_DESCRIPTION_MAX_LENGTH,
  STORE_NAME_MAX_LENGTH,
  STORE_PHONE_MAX_LENGTH,
} from './limits';

export const storeInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '매장 이름을 입력해 주세요.')
    .max(STORE_NAME_MAX_LENGTH, `매장 이름은 ${STORE_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`),
  phone: z.string().trim().max(STORE_PHONE_MAX_LENGTH, '전화번호가 너무 길어요.'),
  address: z.string().trim().max(STORE_ADDRESS_MAX_LENGTH, '주소가 너무 길어요.'),
  description: z
    .string()
    .trim()
    .max(
      STORE_DESCRIPTION_MAX_LENGTH,
      `소개는 ${STORE_DESCRIPTION_MAX_LENGTH}자 이내로 입력해 주세요.`,
    ),
});

export const notificationSettingsSchema = z.object({
  newOrderSound: z.boolean(),
  newOrderBanner: z.boolean(),
  soldOutReminder: z.boolean(),
  dailySummary: z.boolean(),
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_PER_WEEK = 7;

const businessDaySchema = z
  .object({
    /** 0 = Monday ... 6 = Sunday. */
    weekday: z
      .number()
      .int()
      .min(0)
      .max(DAYS_PER_WEEK - 1),
    isClosed: z.boolean(),
    opensAt: z.string().regex(TIME_PATTERN),
    closesAt: z.string().regex(TIME_PATTERN),
  })
  .refine((day) => day.isClosed || day.closesAt > day.opensAt, {
    message: '마감 시간이 오픈 시간보다 늦어야 해요.',
    path: ['closesAt'],
  });

/** Hours are display-only (OQ-11): they never block ordering. "HH:MM" strings compare correctly as text. */
export const businessHoursSchema = z
  .array(businessDaySchema)
  .length(DAYS_PER_WEEK)
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === DAYS_PER_WEEK,
    '요일이 중복되었어요.',
  );

export type StoreInfoInput = z.infer<typeof storeInfoSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
