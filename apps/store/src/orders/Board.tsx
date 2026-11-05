import { BellRing, ClipboardCheck, Coffee, PackageCheck, type LucideIcon } from 'lucide-react';
import { BOARD_STATUSES, type StaffAction } from '@/domain/orderTransitions';
import { ORDER_STATUS_LABEL } from '@/domain/labels';
import { ORDER_STATUS, type Order, type OrderStatus } from '@/domain/models';
import { cn } from '@/lib/cn';
import { OrderCard } from './OrderCard';

const COLUMN_ICON: Record<string, LucideIcon> = {
  [ORDER_STATUS.PAID]: BellRing,
  [ORDER_STATUS.ACCEPTED]: ClipboardCheck,
  [ORDER_STATUS.PREPARING]: Coffee,
  [ORDER_STATUS.READY]: PackageCheck,
};

type BoardProps = {
  orders: Order[];
  nowMs: number;
  onSelect: (order: Order) => void;
  onAction: (order: Order, action: StaffAction) => void;
};

function ordersFor(orders: Order[], status: OrderStatus): Order[] {
  // Oldest first: the order that has waited longest is handled first.
  return orders
    .filter((order) => order.status === status)
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
}

/** Four status columns, left to right in the order of the workflow. Scrolls sideways on narrow screens. */
export function Board({ orders, nowMs, onSelect, onAction }: BoardProps) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:px-6 sm:pb-6">
      {BOARD_STATUSES.map((status) => {
        const columnOrders = ordersFor(orders, status);
        const Icon = COLUMN_ICON[status];
        const headingId = `board-column-${status}`;
        const isNewColumn = status === ORDER_STATUS.PAID;
        return (
          <section
            key={status}
            aria-labelledby={headingId}
            className="flex min-w-[17.5rem] flex-1 flex-col rounded-2xl border border-border bg-card/60"
          >
            <header
              className={cn(
                'flex items-center justify-between gap-2 rounded-t-2xl px-4 py-3',
                isNewColumn ? 'bg-primary text-primary-foreground' : 'bg-card',
              )}
            >
              <h2 id={headingId} className="flex items-center gap-2 text-base font-bold">
                {Icon ? <Icon className="size-5" aria-hidden="true" /> : null}
                {ORDER_STATUS_LABEL[status]}
              </h2>
              <span
                className={cn(
                  'min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-bold tabular-nums',
                  isNewColumn
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-secondary text-secondary-foreground',
                )}
                aria-label={`${columnOrders.length}건`}
              >
                {columnOrders.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              {columnOrders.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {ORDER_STATUS_LABEL[status]} 주문이 없어요
                </p>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    nowMs={nowMs}
                    onSelect={onSelect}
                    onAction={onAction}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
