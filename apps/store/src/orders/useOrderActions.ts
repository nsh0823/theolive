import { useTransitionOrder } from '@theolive/api';
import { useCallback, useRef } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import type { Order } from '@/domain/models';
import { STAFF_ACTION, STAFF_ACTION_LABEL, type StaffAction } from '@/domain/orderTransitions';
import { describeError } from '@/lib/errorMessage';
import { useToast } from '@/ui/Toast';
import type { RejectOrderInput } from '@theolive/validation';

export type OrderActionRunner = {
  /** Resolves true when the server accepted the action (or had already applied it). */
  run: (order: Order, action: StaffAction, rejection?: RejectOrderInput) => Promise<boolean>;
  isBusy: boolean;
};

/**
 * Sends a staff action to the server (SW-03/SW-04). The tablet's current status travels with it, so a second
 * tablet's earlier tap answers STALE_STATUS: the toast says so and the board refetches. One action per order
 * at a time, so a double tap cannot send two requests.
 */
export function useOrderActions(): OrderActionRunner {
  const client = useSupabase();
  const transition = useTransitionOrder(client);
  const { notify } = useToast();
  const inFlight = useRef(new Set<string>());

  const run = useCallback<OrderActionRunner['run']>(
    async (order, action, rejection) => {
      if (inFlight.current.has(order.id)) return false;
      inFlight.current.add(order.id);
      try {
        const result = await transition.mutateAsync({
          orderId: order.id,
          action,
          expectedStatus: order.status,
          reasonCode: rejection?.reasonCode,
          reason: rejection && rejection.reason !== '' ? rejection.reason : undefined,
        });
        if (!result.isReplay) {
          notify(
            action === STAFF_ACTION.REJECT
              ? `${order.orderNumber} 주문을 거절했어요`
              : `${order.orderNumber} 주문: ${STAFF_ACTION_LABEL[action]} 처리했어요`,
          );
        }
        return true;
      } catch (error) {
        notify(describeError(error));
        return false;
      } finally {
        inFlight.current.delete(order.id);
      }
    },
    [transition, notify],
  );

  return { run, isBusy: transition.isPending };
}
