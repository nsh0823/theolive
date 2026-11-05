import { useCallback } from 'react';
import { applyOrderAction } from '@/data/actions';
import { STAFF_ACTION, STAFF_ACTION_LABEL, type StaffAction } from '@/domain/orderTransitions';
import type { Order } from '@/domain/models';
import { useToast } from '@/ui/Toast';

/** Applies a staff action and gives visible feedback (PRD 5.7). The server will own the real transition. */
export function useOrderActions(): (
  order: Order,
  action: StaffAction,
  rejectReason?: string,
) => boolean {
  const { notify } = useToast();
  return useCallback(
    (order, action, rejectReason) => {
      const result = applyOrderAction(order.id, action, rejectReason ?? null);
      if (!result.ok) {
        notify(`${order.orderNumber} 주문은 현재 상태에서 처리할 수 없어요`);
        return false;
      }
      notify(
        action === STAFF_ACTION.REJECT
          ? `${order.orderNumber} 주문을 거절했어요`
          : `${order.orderNumber} 주문: ${STAFF_ACTION_LABEL[action]} 처리했어요`,
      );
      return true;
    },
    [notify],
  );
}
