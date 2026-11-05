import { canProcessOrders, useMenuItems, useStoreStatus, canManageOperations } from '@theolive/api';
import { useState } from 'react';
import { AUTH_STATUS } from '@/auth/accessRules';
import { useAuth, useSupabase } from '@/auth/AuthContext';
import { useBoardOrdersQuery } from '@/data/orderQueries';
import { QUERY_STATUS } from '@/data/queryStatus';
import { ORDER_STATUS, type Order } from '@/domain/models';
import { STAFF_ACTION, type StaffAction } from '@/domain/orderTransitions';
import { useNow } from '@/lib/useNow';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { useToast } from '@/ui/Toast';
import type { RejectOrderInput } from '@theolive/validation';
import { Board } from './Board';
import { BoardSkeleton } from './BoardSkeleton';
import { ConnectionBanner } from './ConnectionBanner';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { RejectDialog } from './RejectDialog';
import { CONTROLS_TAB, StoreControlsDrawer, type ControlsTab } from './StoreControlsDrawer';
import { TopBar } from './TopBar';
import { useBoardConnection } from './useBoardConnection';
import { useOrderActions } from './useOrderActions';

/** Store Web: real-time order board for staff (tablet landscape first). /orders */
export function OrdersPage() {
  const client = useSupabase();
  const orders = useBoardOrdersQuery();
  const menu = useMenuItems(client);
  const storeStatus = useStoreStatus(client);
  const { isConnected } = useBoardConnection();
  const { state: authState } = useAuth();
  const access = authState.status === AUTH_STATUS.SIGNED_IN ? authState.access : null;
  const canManage = canManageOperations(access);
  const nowMs = useNow();
  const { run, isBusy } = useOrderActions();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [controlsTab, setControlsTab] = useState<ControlsTab | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(true);

  if (!canProcessOrders(access)) {
    return (
      <main className="flex h-dvh items-center justify-center p-6">
        <p role="alert" className="max-w-sm text-center text-base font-semibold">
          주문을 처리할 권한이 없어요. 점주에게 권한을 요청해 주세요.
        </p>
      </main>
    );
  }

  const findOrder = (id: string | null): Order | null =>
    orders.data.find((order) => order.id === id) ?? null;
  const newOrderCount =
    orders.status === QUERY_STATUS.SUCCESS
      ? orders.data.filter((order) => order.status === ORDER_STATUS.PAID).length
      : null;
  const soldOutCount = (menu.data ?? []).filter((item) => item.isSoldOut).length;

  async function handleAction(order: Order, action: StaffAction): Promise<void> {
    if (await run(order, action)) setSelectedId(null);
  }

  async function handleReject(rejection: RejectOrderInput): Promise<void> {
    const order = findOrder(rejectingId);
    if (order && (await run(order, STAFF_ACTION.REJECT, rejection))) {
      setRejectingId(null);
      setSelectedId(null);
    }
  }

  function handleRefresh(): void {
    orders.refetch();
    void menu.refetch();
    void storeStatus.refetch();
    notify('미처리 주문을 다시 불러왔어요');
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        status={storeStatus.data ?? null}
        newOrderCount={newOrderCount}
        soldOutCount={soldOutCount}
        isSoundOn={isSoundOn}
        isConnected={isConnected}
        canManageOperations={canManage}
        onToggleSound={() => setIsSoundOn((previous) => !previous)}
        onOpenStatus={() => setControlsTab(CONTROLS_TAB.STATUS)}
        onOpenSoldOut={() => setControlsTab(CONTROLS_TAB.SOLD_OUT)}
      />
      {!isConnected ? <ConnectionBanner onReconnect={handleRefresh} /> : null}
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
              처리할 주문이 아직 없어요. 새 주문이 도착하면 이곳에 바로 표시돼요.
            </p>
          ) : null}
          <Board
            orders={orders.data}
            nowMs={nowMs}
            onSelect={(order) => setSelectedId(order.id)}
            onAction={(order, action) => void handleAction(order, action)}
            isBusy={isBusy}
          />
        </QueryBoundary>
      </main>

      <OrderDetailDrawer
        order={findOrder(selectedId)}
        onClose={() => setSelectedId(null)}
        onAction={(order, action) => void handleAction(order, action)}
        onRequestReject={(order) => setRejectingId(order.id)}
        isBusy={isBusy}
      />
      <RejectDialog
        key={rejectingId ?? 'none'}
        order={findOrder(rejectingId)}
        isBusy={isBusy}
        onCancel={() => setRejectingId(null)}
        onConfirm={(rejection) => void handleReject(rejection)}
      />
      <StoreControlsDrawer
        open={controlsTab !== null}
        tab={controlsTab ?? CONTROLS_TAB.STATUS}
        onTabChange={setControlsTab}
        onClose={() => setControlsTab(null)}
      />
    </div>
  );
}
