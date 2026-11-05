import { create } from 'zustand';

import { ORDER_TYPE, type CartLine, type OrderType, type Temperature } from '@/models';

export const MIN_LINE_QUANTITY = 1;
export const MAX_LINE_QUANTITY = 20;

type CartState = {
  lines: CartLine[];
  orderType: OrderType;
  addLine: (menuItemId: string, temperature: Temperature, quantity: number) => void;
  setQuantity: (menuItemId: string, temperature: Temperature, quantity: number) => void;
  removeLine: (menuItemId: string, temperature: Temperature) => void;
  setOrderType: (orderType: OrderType) => void;
};

const isSameLine = (line: CartLine, menuItemId: string, temperature: Temperature) =>
  line.menuItemId === menuItemId && line.temperature === temperature;

const clampQuantity = (quantity: number) =>
  Math.min(MAX_LINE_QUANTITY, Math.max(MIN_LINE_QUANTITY, quantity));

/** In-memory only: carts are never persisted locally (the server owns orders). */
export const useCartStore = create<CartState>()((set) => ({
  lines: [],
  orderType: ORDER_TYPE.TAKEOUT,
  addLine: (menuItemId, temperature, quantity) =>
    set((state) => {
      const existing = state.lines.find((line) => isSameLine(line, menuItemId, temperature));
      if (!existing) {
        return {
          lines: [...state.lines, { menuItemId, temperature, quantity: clampQuantity(quantity) }],
        };
      }
      return {
        lines: state.lines.map((line) =>
          line === existing ? { ...line, quantity: clampQuantity(line.quantity + quantity) } : line,
        ),
      };
    }),
  setQuantity: (menuItemId, temperature, quantity) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        isSameLine(line, menuItemId, temperature)
          ? { ...line, quantity: clampQuantity(quantity) }
          : line,
      ),
    })),
  removeLine: (menuItemId, temperature) =>
    set((state) => ({
      lines: state.lines.filter((line) => !isSameLine(line, menuItemId, temperature)),
    })),
  setOrderType: (orderType) => set({ orderType }),
}));
