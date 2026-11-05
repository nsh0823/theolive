import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog, DIALOG_PLACEMENT } from '@/ui/Dialog';
import { OrderDetailBody } from '@/shared/OrderDetailBody';
import {
  STAFF_ACTION,
  STAFF_ACTION_LABEL,
  availableStaffActions,
  type StaffAction,
} from '@/domain/orderTransitions';
import type { Order } from '@/domain/models';
import { ORDER_ACTION_ICON } from './actionIcons';

type OrderDetailDrawerProps = {
  order: Order | null;
  onClose: () => void;
  onAction: (order: Order, action: StaffAction) => void;
  onRequestReject: (order: Order) => void;
  isBusy?: boolean;
};

/** Order detail with only the actions that are valid for the current status (PRD 7.1). */
export function OrderDetailDrawer({
  order,
  onClose,
  onAction,
  onRequestReject,
  isBusy = false,
}: OrderDetailDrawerProps) {
  const actions = order ? availableStaffActions(order.status) : [];

  return (
    <Dialog
      open={order !== null}
      onClose={onClose}
      title={order ? `주문 ${order.orderNumber}` : '주문 상세'}
      description="주문 상세와 처리 상태를 확인하세요."
      placement={DIALOG_PLACEMENT.RIGHT}
      widthClass="max-w-md"
      footer={
        order && actions.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            {actions.map((action) => {
              const Icon = ORDER_ACTION_ICON[action];
              const isReject = action === STAFF_ACTION.REJECT;
              return (
                <Button
                  key={action}
                  size={BUTTON_SIZE.LG}
                  variant={isReject ? BUTTON_VARIANT.OUTLINE : BUTTON_VARIANT.PRIMARY}
                  className={isReject ? 'w-full border-destructive text-destructive' : 'w-full'}
                  icon={<Icon className="size-5" aria-hidden="true" />}
                  disabled={isBusy}
                  onClick={() => (isReject ? onRequestReject(order) : onAction(order, action))}
                >
                  {STAFF_ACTION_LABEL[action]}
                </Button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      {order ? <OrderDetailBody order={order} /> : null}
    </Dialog>
  );
}
