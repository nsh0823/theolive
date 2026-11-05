import type { CartLine, MenuItem, Order } from '@/models';
import { ORDER_STATUS } from '@/models';

export type RecentOrderLine = {
  key: string;
  orderId: string;
  menuItemId: string;
  name: string;
  temperature: CartLine['temperature'];
  quantity: number;
  placedAt: string;
};

const NOT_REORDERABLE_SOURCE = new Set<string>([ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED]);

/** Newest-first list of previously ordered products for Home's quick reorder (orders arrive newest first). */
export function recentOrderLines(orders: Order[], limit: number): RecentOrderLine[] {
  return orders
    .filter((order) => !NOT_REORDERABLE_SOURCE.has(order.status))
    .flatMap((order) =>
      order.lines.map((line, index) => ({
        key: `${order.id}-${index}`,
        orderId: order.id,
        menuItemId: line.menuItemId,
        name: line.name,
        temperature: line.temperature,
        quantity: line.quantity,
        placedAt: order.placedAt,
      })),
    )
    .slice(0, limit);
}

export type ReorderPlan = { add: CartLine[]; skippedNames: string[] };

/**
 * Maps past lines onto the current menu. Items that are gone, sold out, or no longer sold
 * in that temperature are skipped; prices always come from the current menu (server-owned).
 */
export function planReorder(
  lines: Pick<RecentOrderLine, 'menuItemId' | 'name' | 'temperature' | 'quantity'>[],
  menu: MenuItem[],
): ReorderPlan {
  const add: CartLine[] = [];
  const skippedNames: string[] = [];
  for (const line of lines) {
    const item = menu.find((candidate) => candidate.id === line.menuItemId);
    const canOrder = item && !item.isSoldOut && item.temperatures.includes(line.temperature);
    if (canOrder) {
      add.push({
        menuItemId: line.menuItemId,
        temperature: line.temperature,
        quantity: line.quantity,
      });
    } else {
      skippedNames.push(line.name);
    }
  }
  return { add, skippedNames };
}
