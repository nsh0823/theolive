import { TEMPERATURE, type MenuCategory, type MenuItem, type Temperature } from './models';

export const MENU_NAME_MAX_LENGTH = 30;
export const MENU_DESCRIPTION_MAX_LENGTH = 100;
export const MENU_PRICE_MAX = 100000;

/** HOT / ICE are the only options the MVP supports (brief; PRD ORD-04). */
export const MENU_TEMPERATURE_CHOICES: readonly Temperature[] = [TEMPERATURE.HOT, TEMPERATURE.ICE];

export type MenuFormValues = {
  name: string;
  description: string;
  priceText: string;
  categoryId: string;
  temperatures: Temperature[];
  isActive: boolean;
};

export type MenuFormErrors = Partial<
  Record<'name' | 'description' | 'price' | 'category' | 'temperatures', string>
>;

export type MenuFormFields = Pick<
  MenuItem,
  'name' | 'description' | 'price' | 'categoryId' | 'temperatures' | 'isActive'
>;

export type MenuFormResult =
  | {
      ok: true;
      fields: Pick<
        MenuItem,
        'name' | 'description' | 'price' | 'categoryId' | 'temperatures' | 'isActive'
      >;
    }
  | { ok: false; errors: MenuFormErrors };

/** UI validation only; the server validates again before saving. */
export function validateMenuForm(values: MenuFormValues): MenuFormResult {
  const errors: MenuFormErrors = {};
  const name = values.name.trim();
  const price = Number(values.priceText);

  if (name === '') errors.name = '메뉴 이름을 입력해 주세요.';
  else if (name.length > MENU_NAME_MAX_LENGTH)
    errors.name = `이름은 ${MENU_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`;
  if (values.description.length > MENU_DESCRIPTION_MAX_LENGTH)
    errors.description = `설명은 ${MENU_DESCRIPTION_MAX_LENGTH}자 이내로 입력해 주세요.`;
  if (
    values.priceText.trim() === '' ||
    !Number.isInteger(price) ||
    price <= 0 ||
    price > MENU_PRICE_MAX
  ) {
    errors.price = `가격은 1원 이상 ${MENU_PRICE_MAX.toLocaleString('ko-KR')}원 이하의 숫자로 입력해 주세요.`;
  }
  if (values.categoryId === '') errors.category = '카테고리를 선택해 주세요.';
  if (values.temperatures.length === 0)
    errors.temperatures = 'HOT 또는 ICE를 하나 이상 선택해 주세요.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      name,
      description: values.description.trim(),
      price,
      categoryId: values.categoryId,
      temperatures: values.temperatures,
      isActive: values.isActive,
    },
  };
}

export function initialMenuFormValues(
  target: MenuItem | 'new',
  categories: MenuCategory[],
): MenuFormValues {
  if (target === 'new') {
    return {
      name: '',
      description: '',
      priceText: '',
      categoryId: categories[0]?.id ?? '',
      temperatures: [...MENU_TEMPERATURE_CHOICES],
      isActive: true,
    };
  }
  return {
    name: target.name,
    description: target.description,
    priceText: String(target.price),
    categoryId: target.categoryId,
    temperatures: target.temperatures,
    isActive: target.isActive,
  };
}
