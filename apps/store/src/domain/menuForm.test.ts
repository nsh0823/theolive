import { describe, expect, it } from 'vitest';
import { MENU_TEMPERATURE_CHOICES, validateMenuForm, type MenuFormValues } from './menuForm';
import { TEMPERATURE } from './models';

const COFFEE_ID = '00000000-0000-4000-8000-000000000101';

const valid: MenuFormValues = {
  name: ' 아메리카노 ',
  description: '',
  priceText: '4500',
  categoryId: COFFEE_ID,
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

  it('requires a name, a valid price and a category', () => {
    const result = validateMenuForm({ ...valid, name: ' ', priceText: '-1', categoryId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual(['category', 'name', 'price']);
  });

  it('allows an item with no temperature choice (OQ-16)', () => {
    const result = validateMenuForm({ ...valid, temperatures: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fields.temperatures).toEqual([]);
  });

  it('rejects empty, fractional and oversized prices', () => {
    expect(validateMenuForm({ ...valid, priceText: '' }).ok).toBe(false);
    expect(validateMenuForm({ ...valid, priceText: 'abc' }).ok).toBe(false);
    expect(validateMenuForm({ ...valid, priceText: '4500.5' }).ok).toBe(false);
    expect(validateMenuForm({ ...valid, priceText: '100001' }).ok).toBe(false);
  });

  it('offers only HOT and ICE as options (no size, syrup, milk, shot)', () => {
    expect(MENU_TEMPERATURE_CHOICES).toEqual(['HOT', 'ICE']);
  });
});
