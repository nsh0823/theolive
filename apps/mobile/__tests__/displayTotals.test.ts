import {
  displayItemCount,
  displaySubtotal,
  hasSoldOutLine,
  joinCartLines,
  previewCheckoutAmounts,
} from '@/lib/displayTotals';
import { FIXTURE_MENU } from '@/fixtures/data';

describe('display totals', () => {
  const lines = [
    { menuItemId: 'americano', temperature: 'HOT' as const, quantity: 2 },
    { menuItemId: 'vanilla-latte', temperature: 'ICE' as const, quantity: 1 },
    { menuItemId: 'missing', temperature: 'ICE' as const, quantity: 1 },
  ];
  const entries = joinCartLines(lines, FIXTURE_MENU);

  it('drops lines whose menu item no longer exists', () => {
    expect(entries).toHaveLength(2);
  });

  it('sums price x quantity and counts items', () => {
    expect(displaySubtotal(entries)).toBe(4500 * 2 + 5500);
    expect(displayItemCount(entries)).toBe(3);
  });

  it('flags sold-out lines', () => {
    expect(hasSoldOutLine(entries)).toBe(true);
  });

  it('previews coupon and points without going negative', () => {
    expect(previewCheckoutAmounts(9000, 5000, 12000, true)).toEqual({
      menuAmount: 9000,
      couponDiscount: 5000,
      pointsUsed: 4000,
      finalAmount: 0,
    });
    expect(previewCheckoutAmounts(4500, 5000, 0, false).finalAmount).toBe(0);
    expect(previewCheckoutAmounts(4500, 0, 1000, true).finalAmount).toBe(3500);
  });
});
