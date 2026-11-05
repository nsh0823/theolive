import { useMenuItems } from '@theolive/api';
import { Link } from 'react-router';
import { Bell } from 'lucide-react';
import { PopoverMenu } from '@/ui/PopoverMenu';
import { useSupabase } from '@/auth/AuthContext';
import { useBoardOrdersQuery } from '@/data/orderQueries';
import { ORDER_STATUS } from '@/domain/models';
import { ROUTES } from '@/lib/routes';

/** Header bell: summarizes what needs attention (new paid orders and sold-out items), both from the server. */
export function NotificationBell() {
  const orders = useBoardOrdersQuery().data;
  const menu = useMenuItems(useSupabase());
  const newOrders = orders.filter((order) => order.status === ORDER_STATUS.PAID).length;
  const soldOut = (menu.data ?? []).filter((item) => item.isSoldOut).length;
  const total = (newOrders > 0 ? 1 : 0) + (soldOut > 0 ? 1 : 0);

  return (
    <PopoverMenu
      label={total > 0 ? `알림 ${total}건` : '알림 없음'}
      triggerClassName="relative size-11 justify-center"
      trigger={
        <>
          <Bell className="size-5" aria-hidden="true" />
          {total > 0 ? (
            <span
              className="absolute right-2 top-2 size-2.5 rounded-full bg-destructive ring-2 ring-card"
              aria-hidden="true"
            />
          ) : null}
        </>
      }
    >
      <p className="px-3 py-2 text-sm font-semibold">알림</p>
      {total === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted-foreground">새 알림이 없어요.</p>
      ) : null}
      {newOrders > 0 ? (
        <Link
          to={ROUTES.ORDERS}
          className="block rounded-xl px-3 py-2.5 text-sm hover:bg-background"
        >
          접수 대기 중인 신규 주문이 {newOrders}건 있어요.
        </Link>
      ) : null}
      {soldOut > 0 ? (
        <Link
          to={ROUTES.ADMIN_MENU}
          className="block rounded-xl px-3 py-2.5 text-sm hover:bg-background"
        >
          품절 처리된 메뉴가 {soldOut}개 있어요.
        </Link>
      ) : null}
    </PopoverMenu>
  );
}
