import { z } from 'zod';

import {
  CATEGORY_NAME_MAX_LENGTH,
  MENU_DESCRIPTION_MAX_LENGTH,
  MENU_NAME_MAX_LENGTH,
  MENU_PRICE_MAX,
  MENU_TEMPERATURE_MAX_COUNT,
} from './limits';

const PRICE_MESSAGE = `가격은 1원 이상 ${MENU_PRICE_MAX.toLocaleString('ko-KR')}원 이하의 숫자로 입력해 주세요.`;

export const temperatureSchema = z.enum(['HOT', 'ICE']);

/** HOT / ICE are the only options the MVP supports (PRD ORD-04). An empty list means no temperature choice (OQ-16). */
const temperaturesSchema = z
  .array(temperatureSchema)
  .max(MENU_TEMPERATURE_MAX_COUNT)
  .refine((values) => new Set(values).size === values.length, '온도가 중복되었어요.');

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, '카테고리 이름을 입력해 주세요.')
  .max(CATEGORY_NAME_MAX_LENGTH, `이름은 ${CATEGORY_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`);

export const categorySchema = z.object({
  id: z.uuid().nullable(),
  name: categoryNameSchema,
  isActive: z.boolean(),
});

export const menuItemInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '메뉴 이름을 입력해 주세요.')
    .max(MENU_NAME_MAX_LENGTH, `이름은 ${MENU_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`),
  description: z
    .string()
    .trim()
    .max(
      MENU_DESCRIPTION_MAX_LENGTH,
      `설명은 ${MENU_DESCRIPTION_MAX_LENGTH}자 이내로 입력해 주세요.`,
    ),
  price: z
    .number(PRICE_MESSAGE)
    .int(PRICE_MESSAGE)
    .min(1, PRICE_MESSAGE)
    .max(MENU_PRICE_MAX, PRICE_MESSAGE),
  categoryId: z.uuid('카테고리를 선택해 주세요.'),
  temperatures: temperaturesSchema,
  isActive: z.boolean(),
  /** Object path inside the `menu-images` bucket, or null for no image. */
  imagePath: z.string().max(200).nullable(),
});

export type MenuItemInput = z.infer<typeof menuItemInputSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
