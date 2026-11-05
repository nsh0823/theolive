import type { CartLine, MenuItem } from '@/models';

export const CART_PROBLEM = {
  /** Hidden, archived, deleted, or no longer sold in the chosen temperature: it cannot be ordered at all. */
  UNAVAILABLE: 'UNAVAILABLE',
  SOLD_OUT: 'SOLD_OUT',
} as const;
export type CartProblem = (typeof CART_PROBLEM)[keyof typeof CART_PROBLEM];

function offersTemperature(item: MenuItem, temperature: CartLine['temperature']): boolean {
  if (temperature === null) return item.temperatures.length === 0;
  return item.temperatures.includes(temperature);
}

/** What is wrong with a cart line against the current server menu, or null when it can be ordered. */
export function cartLineProblem(line: CartLine, menu: MenuItem[]): CartProblem | null {
  const item = menu.find((candidate) => candidate.id === line.menuItemId);
  if (!item || !offersTemperature(item, line.temperature)) return CART_PROBLEM.UNAVAILABLE;
  return item.isSoldOut ? CART_PROBLEM.SOLD_OUT : null;
}

/**
 * Splits the cart: lines that can no longer exist (UNAVAILABLE) are dropped automatically; sold-out lines
 * stay visible, flagged, so the customer removes them with one tap (they block checkout).
 */
export function pruneCart(
  lines: CartLine[],
  menu: MenuItem[],
): { kept: CartLine[]; removed: CartLine[]; hasSoldOut: boolean } {
  const kept: CartLine[] = [];
  const removed: CartLine[] = [];
  for (const line of lines) {
    (cartLineProblem(line, menu) === CART_PROBLEM.UNAVAILABLE ? removed : kept).push(line);
  }
  return { kept, removed, hasSoldOut: kept.some((l) => cartLineProblem(l, menu) !== null) };
}

export function removeSoldOut(lines: CartLine[], menu: MenuItem[]): CartLine[] {
  return lines.filter((line) => cartLineProblem(line, menu) === null);
}
