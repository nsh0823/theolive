import { Link } from 'react-router';
import { Receipt } from 'lucide-react';
import type { MemberOrderView } from '@theolive/api';
import { OrderStatusBadge } from '@/shared/badges';
import { ORDER_STATUS } from '@/domain/models';
import { Card, CardHeader } from '@/ui/Card';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatDateTime, formatWon } from '@/lib/format';
import { orderDetailPath } from '@/lib/routes';

function StatusCell({ status }: { status: string }) {
  const known = Object.values(ORDER_STATUS).find((value) => value === status);
  return known ? <OrderStatusBadge status={known} /> : <span>{status}</span>;
}

/** The member's paid orders as the server returned them (newest first, at most 50). */
export function MemberOrdersCard({ orders }: { orders: MemberOrderView[] }) {
  return (
    <Card>
      <CardHeader icon={<Receipt className="size-5" />} title="주문 내역" />
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          아직 주문 내역이 없어요.
        </p>
      ) : (
        <DataTable caption="회원의 주문 내역">
          <thead>
            <tr>
              <Th>주문번호</Th>
              <Th>주문 일시</Th>
              <Th className="text-right">결제 금액</Th>
              <Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>
                  <Link
                    to={orderDetailPath(order.id)}
                    aria-label={`주문 ${order.orderNumber ?? ''} 상세 보기`}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-bold text-primary underline-offset-4 hover:underline tabular-nums"
                  >
                    {order.orderNumber ?? '-'}
                  </Link>
                </Td>
                <Td className="tabular-nums">{formatDateTime(order.placedAt)}</Td>
                <Td className="text-right tabular-nums">{formatWon(order.paidAmount)}</Td>
                <Td>
                  <StatusCell status={order.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}
