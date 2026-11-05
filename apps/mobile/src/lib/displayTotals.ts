import type { CartLine, MenuItem } from '@/models';

export type DisplayCartLine = { line: CartLine; item: MenuItem };

/** Joins cart lines with menu data; lines whose menu item no longer exists are dropped. */
export function joinCartLines(lines: CartLine[], menu: MenuItem[]): DisplayCartLine[] {
  return lines.flatMap((line) => {
    const item = menu.find((candidate) => candidate.id === line.menuItemId);
    return item ? [{ line, item }] : [];
  });
}

/**
 * Display-only subtotal. The authoritative price is recalculated on the server (PRD 5.3);
 * never send this value as a price.
 */
export function displaySubtotal(lines: DisplayCartLine[]): number {
  return lines.reduce((sum, { line, item }) => sum + item.price * line.quantity, 0);
}

export function displayItemCount(lines: DisplayCartLine[]): number {
  return lines.reduce((sum, { line }) => sum + line.quantity, 0);
}

export function hasSoldOutLine(lines: DisplayCartLine[]): boolean {
  return lines.some(({ item }) => item.isSoldOut);
}

export type DisplayAmounts = {
  menuAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  finalAmount: number;
};

/**
 * Display-only preview of the checkout breakdown (PRD 5.4 PAY-01). Coupon and point
 * limits, minimum units, and the real final charge are decided by the server (PRD 15).
 */
export function previewCheckoutAmounts(
  menuAmount: number,
  couponDiscount: number,
  pointBalance: number,
  usePoints: boolean,
): DisplayAmounts {
  const afterCoupon = Math.max(0, menuAmount - couponDiscount);
  const pointsUsed = usePoints ? Math.min(pointBalance, afterCoupon) : 0;
  return {
    menuAmount,
    couponDiscount: Math.min(couponDiscount, menuAmount),
    pointsUsed,
    finalAmount: afterCoupon - pointsUsed,
  };
}
