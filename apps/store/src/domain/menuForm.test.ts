import { describe, expect, it } from 'vitest';
import { MENU_TEMPERATURE_CHOICES, validateMenuForm, type MenuFormValues } from './menuForm';
import { TEMPERATURE } from './models';

const valid: MenuFormValues = {
  name: ' 아메리카노 ',
  description: '',
  priceText: '4500',
  categoryId: 'coffee',
  temperatures: [TEMPERATURE.HOT, TEMPERATURE.ICE],
  isActive: true,
};

describe('validateMenuForm', () => {
  it('accepts a valid form and trims the name', () => {
    const result = validateMenuForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.name).toBe('아메리카노');
      expect(result.fields.price).toBe(4500);
    }
  });

  it('requires a name, a valid price, a category and at least one of HOT/ICE', () => {
    const result = validateMenuForm({
      ...valid,
      name: ' ',
      priceText: '-1',
      categoryId: '',
      temperatures: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual([
        'category',
        'name',
        'price',
        'temperatures',
      ]);
  });

  it('rejects fractional and oversized prices', () => {
    expect(validateMenuForm({ ...valid, priceText: '4500.5' }).ok).toBe(false);
    expect(validateMenuForm({ ...valid, priceText: '100001' }).ok).toBe(false);
  });

  it('offers only HOT and ICE as options (no size, syrup, milk, shot)', () => {
    expect(MENU_TEMPERATURE_CHOICES).toEqual(['HOT', 'ICE']);
  });
});
