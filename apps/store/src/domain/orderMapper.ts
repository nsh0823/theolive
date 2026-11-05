import type { OrderView } from '@theolive/api';
import { ORDER_REJECT_REASON, type OrderRejectReason } from '@theolive/types';
import { REJECT_REASON_LABEL } from './labels';
import type { Order } from './models';

const REJECT_CODES: readonly string[] = Object.values(ORDER_REJECT_REASON);

function isRejectReason(code: string | null): code is OrderRejectReason {
  return code !== null && REJECT_CODES.includes(code);
}

/** The reason line staff and admins read: the chosen label, plus the written text when there is one. */
export function describeRejectReason(code: string | null, text: string | null): string | null {
  if (!isRejectReason(code)) return text;
  if (code === ORDER_REJECT_REASON.OTHER) return text ?? REJECT_REASON_LABEL[code];
  return text ? `${REJECT_REASON_LABEL[code]} · ${text}` : REJECT_REASON_LABEL[code];
}

/** Shown where an order number belongs while an order has none (only unpaid orders, which staff never see). */
export const NO_ORDER_NUMBER = '-';

/** Server order (packages/api) to the store screens' view-model. Totals are the server's, never recomputed. */
export function toStoreOrder(view: OrderView): Order {
  return {
    id: view.id,
    orderNumber: view.orderNumber ?? NO_ORDER_NUMBER,
    placedAt: view.placedAt,
    status: view.status,
    paymentStatus: view.paymentStatus,
    paymentMethod: view.paymentMethod,
    orderType: view.orderType,
    lines: view.lines.map((line) => ({
      menuItemId: line.menuItemId ?? line.name,
      name: line.name,
      temperature: line.temperature,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    note: view.note,
    menuAmount: view.menuAmount,
    couponDiscount: view.couponDiscount,
    couponTitle: view.couponTitle,
    pointsUsed: view.pointsUsed,
    paidAmount: view.paidAmount,
    memberId: view.memberId,
    rejectReason: describeRejectReason(view.rejectReasonCode, view.rejectReason),
    endedAt: view.endedAt,
    cancelReason: view.cancelReason,
  };
}
