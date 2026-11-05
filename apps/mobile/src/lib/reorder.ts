import type { CartLine, MenuItem, Order, OrderLine } from '@/models';
import { ORDER_STATUS } from '@/models';

import { formatDateTime } from './format';

export type RecentOrderLine = {
  key: string;
  orderId: string;
  menuItemId: string;
  name: string;
  temperature: OrderLine['temperature'];
  quantity: number;
  placedAt: string;
};

const NOT_REORDERABLE_SOURCE = new Set<string>([ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED]);

/** Newest-first list of previously ordered products for Home's quick reorder (orders arrive newest first). */
export function recentOrderLines(orders: Order[], limit: number): RecentOrderLine[] {
  return orders
    .filter((order) => !NOT_REORDERABLE_SOURCE.has(order.status))
    .flatMap((order) =>
      order.lines.flatMap((line, index) =>
        // A line whose menu item was deleted has no id to reorder.
        line.menuItemId === null
          ? []
          : [
              {
                key: `${order.id}-${index}`,
                orderId: order.id,
                menuItemId: line.menuItemId,
                name: line.name,
                temperature: line.temperature,
                quantity: line.quantity,
                placedAt: formatDateTime(order.placedAt),
              },
            ],
      ),
    )
    .slice(0, limit);
}

/** A past line can be re-added when the item still sells that temperature (or has no temperature choice). */
function offersTemperature(item: MenuItem, temperature: OrderLine['temperature']): boolean {
  if (temperature === null) return item.temperatures.length === 0;
  return item.temperatures.includes(temperature);
}

export type ReorderPlan = { add: CartLine[]; skippedNames: string[] };

/**
 * Maps past lines onto the current menu. Items that are gone, sold out, or no longer sold
 * in that temperature are skipped; prices always come from the current menu (server-owned).
 */
export function planReorder(
  lines: {
    menuItemId: string | null;
    name: string;
    temperature: OrderLine['temperature'];
    quantity: number;
  }[],
  menu: MenuItem[],
): ReorderPlan {
  const add: CartLine[] = [];
  const skippedNames: string[] = [];
  for (const line of lines) {
    const item = menu.find((candidate) => candidate.id === line.menuItemId);
    const canOrder = item && !item.isSoldOut && offersTemperature(item, line.temperature);
    if (item && canOrder) {
      add.push({
        menuItemId: item.id,
        temperature: line.temperature,
        quantity: line.quantity,
      });
    } else {
      skippedNames.push(line.name);
    }
  }
  return { add, skippedNames };
}
