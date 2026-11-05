import { Sparkles } from 'lucide-react';
import { Button, BUTTON_SIZE } from '@/ui/Button';
import { cn } from '@/lib/cn';
import { formatElapsed, formatTime, formatWon } from '@/lib/format';
import { ORDER_ACTION_ICON } from './actionIcons';
import { ORDER_STATUS, type Order } from '@/domain/models';
import {
  STAFF_ACTION_LABEL,
  availableStaffActions,
  STAFF_ACTION,
  type StaffAction,
} from '@/domain/orderTransitions';
import { OrderStatusBadge, OrderTypeBadge, TemperatureBadge } from '@/shared/badges';

type OrderCardProps = {
  order: Order;
  nowMs: number;
  onSelect: (order: Order) => void;
  onAction: (order: Order, action: StaffAction) => void;
  /** An action is being sent: the quick action is disabled so a double tap cannot repeat it. */
  isBusy?: boolean;
};

/** One order on the board. New orders get a NEW label, a pulse (motion-safe) and a heavier border. */
export function OrderCard({ order, nowMs, onSelect, onAction, isBusy = false }: OrderCardProps) {
  const isNew = order.status === ORDER_STATUS.PAID;
  const quickAction = availableStaffActions(order.status).find(
    (action) => action !== STAFF_ACTION.REJECT,
  );
  const QuickIcon = quickAction ? ORDER_ACTION_ICON[quickAction] : null;

  return (
    <article
      aria-label={`${order.orderNumber} 주문`}
      className={cn(
        'rounded-2xl bg-card shadow-card',
        isNew ? 'border-2 border-primary motion-safe:animate-new-pulse' : 'border border-border',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(order)}
        className="flex min-h-12 w-full flex-col gap-3 rounded-t-2xl p-4 text-left hover:bg-background/60"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {order.orderNumber}
            </span>
            {isNew ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold tracking-wide text-primary-foreground">
                <Sparkles className="size-3.5" aria-hidden="true" />
                NEW
              </span>
            ) : null}
          </span>
          <OrderTypeBadge type={order.orderType} />
        </span>
        <span className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{formatTime(order.placedAt)} 주문</span>
          <span className={cn('tabular-nums', isNew && 'font-bold text-primary')}>
            {formatElapsed(order.placedAt, nowMs)}
          </span>
        </span>
        <span className="flex flex-col gap-1.5">
          {order.lines.map((line) => (
            <span
              key={`${line.menuItemId}-${line.temperature}`}
              className="flex items-center gap-2 text-base"
            >
              <TemperatureBadge temperature={line.temperature} />
              <span className="min-w-0 flex-1 truncate font-semibold">{line.name}</span>
              <span className="font-bold tabular-nums">× {line.quantity}</span>
            </span>
          ))}
        </span>
        {order.note ? (
          <span className="rounded-lg bg-cream px-3 py-2 text-sm">
            <span className="font-semibold">요청 </span>
            {order.note}
          </span>
        ) : null}
        <span className="flex items-center justify-between gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-lg font-bold tabular-nums">{formatWon(order.paidAmount)}</span>
        </span>
      </button>
      {quickAction && QuickIcon ? (
        <div className="px-4 pb-4">
          <Button
            size={BUTTON_SIZE.LG}
            className="w-full"
            icon={<QuickIcon className="size-5" aria-hidden="true" />}
            disabled={isBusy}
            onClick={() => onAction(order, quickAction)}
            aria-label={`${order.orderNumber} ${STAFF_ACTION_LABEL[quickAction]}`}
          >
            {STAFF_ACTION_LABEL[quickAction]}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
