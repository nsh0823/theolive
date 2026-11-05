import { menuItemInputSchema } from '@theolive/validation';
import { TEMPERATURE, type MenuCategory, type MenuItem, type Temperature } from './models';

export {
  MENU_DESCRIPTION_MAX_LENGTH,
  MENU_NAME_MAX_LENGTH,
  MENU_PRICE_MAX,
} from '@theolive/validation';

/** HOT / ICE are the only options the MVP supports (brief; PRD ORD-04). No selection means no temperature choice (OQ-16). */
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
  { ok: true; fields: MenuFormFields } | { ok: false; errors: MenuFormErrors };

const FIELD_FOR_PATH: Record<string, keyof MenuFormErrors> = {
  name: 'name',
  description: 'description',
  price: 'price',
  categoryId: 'category',
  temperatures: 'temperatures',
};

const fieldsSchema = menuItemInputSchema.omit({ imagePath: true });

/** UI validation with the shared schema; the server and the database check again before saving. */
export function validateMenuForm(values: MenuFormValues): MenuFormResult {
  const priceText = values.priceText.trim();
  const parsed = fieldsSchema.safeParse({
    name: values.name,
    description: values.description,
    price: priceText === '' ? Number.NaN : Number(priceText),
    categoryId: values.categoryId,
    temperatures: values.temperatures,
    isActive: values.isActive,
  });
  if (parsed.success) return { ok: true, fields: parsed.data };

  const errors: MenuFormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = FIELD_FOR_PATH[String(issue.path[0])];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
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
