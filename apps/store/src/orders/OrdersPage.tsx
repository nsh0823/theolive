import { useState } from 'react';
import { setConnected } from '@/data/actions';
import { useConnection, useMenuQuery, useOrdersQuery, useStoreStatus } from '@/data/queries';
import { ORDER_STATUS, type Order } from '@/domain/models';
import { STAFF_ACTION, type StaffAction } from '@/domain/orderTransitions';
import { QUERY_STATUS } from '@/data/useFixtureQuery';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { useToast } from '@/ui/Toast';
import { Board } from './Board';
import { BoardSkeleton } from './BoardSkeleton';
import { ConnectionBanner } from './ConnectionBanner';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { RejectDialog } from './RejectDialog';
import { CONTROLS_TAB, StoreControlsDrawer, type ControlsTab } from './StoreControlsDrawer';
import { TopBar } from './TopBar';
import { useNow } from '@/lib/useNow';
import { useOrderActions } from './useOrderActions';

/** Store Web: real-time order board for staff (tablet landscape first). /orders */
export function OrdersPage() {
  const orders = useOrdersQuery();
  const menu = useMenuQuery();
  const status = useStoreStatus();
  const { isConnected } = useConnection();
  const nowMs = useNow();
  const runAction = useOrderActions();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [controlsTab, setControlsTab] = useState<ControlsTab | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(true);

  const findOrder = (id: string | null): Order | null =>
    orders.data.find((order) => order.id === id) ?? null;
  const newOrderCount =
    orders.status === QUERY_STATUS.SUCCESS
      ? orders.data.filter((order) => order.status === ORDER_STATUS.PAID).length
      : null;
  const soldOutCount = menu.data.filter((item) => item.isSoldOut).length;

  function handleAction(order: Order, action: StaffAction): void {
    if (runAction(order, action)) setSelectedId(null);
  }

  function handleReject(reason: string): void {
    const order = findOrder(rejectingId);
    if (order && runAction(order, STAFF_ACTION.REJECT, reason)) {
      setRejectingId(null);
      setSelectedId(null);
    }
  }

  function handleReconnect(): void {
    setConnected(true);
    orders.refetch();
    notify('다시 연결했어요. 미처리 주문을 다시 불러왔어요');
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        status={status}
        newOrderCount={newOrderCount}
        soldOutCount={soldOutCount}
        isSoundOn={isSoundOn}
        isConnected={isConnected}
        onToggleSound={() => setIsSoundOn((previous) => !previous)}
        onOpenStatus={() => setControlsTab(CONTROLS_TAB.STATUS)}
        onOpenSoldOut={() => setControlsTab(CONTROLS_TAB.SOLD_OUT)}
      />
      {!isConnected ? <ConnectionBanner onReconnect={handleReconnect} /> : null}
      <main className="flex min-h-0 flex-1 flex-col">
        <QueryBoundary
          status={orders.status}
          isEmpty={false}
          onRetry={orders.refetch}
          emptyTitle=""
          loadingLabel="주문을 불러오는 중이에요"
          skeleton={<BoardSkeleton />}
        >
          {orders.data.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              오늘 들어온 주문이 아직 없어요. 새 주문이 도착하면 이곳에 바로 표시돼요.
            </p>
          ) : null}
          <Board
            orders={orders.data}
            nowMs={nowMs}
            onSelect={(order) => setSelectedId(order.id)}
            onAction={handleAction}
          />
        </QueryBoundary>
      </main>

      <OrderDetailDrawer
        order={findOrder(selectedId)}
        onClose={() => setSelectedId(null)}
        onAction={handleAction}
        onRequestReject={(order) => setRejectingId(order.id)}
      />
      <RejectDialog
        order={findOrder(rejectingId)}
        onCancel={() => setRejectingId(null)}
        onConfirm={handleReject}
      />
      <StoreControlsDrawer
        open={controlsTab !== null}
        tab={controlsTab ?? CONTROLS_TAB.STATUS}
        onTabChange={setControlsTab}
        status={status}
        onClose={() => setControlsTab(null)}
      />
    </div>
  );
}
