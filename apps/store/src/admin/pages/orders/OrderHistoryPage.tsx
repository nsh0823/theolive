import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useOrdersQuery } from '@/data/queries';
import { EMPTY_ORDER_FILTERS, filterOrders, hasActiveFilters } from '@/domain/orderFilters';
import { summarizeMenu } from '@/domain/summaries';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody } from '@/ui/Card';
import { Dialog, DIALOG_PLACEMENT } from '@/ui/Dialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { OrderDetailBody } from '@/shared/OrderDetailBody';
import { OrderStatusBadge, OrderTypeBadge, PaymentStatusBadge } from '@/shared/badges';
import { formatDateTime, formatWon } from '@/lib/format';
import { OrderFiltersBar } from './OrderFiltersBar';

export function OrderHistoryPage() {
  const orders = useOrdersQuery();
  const [filters, setFilters] = useState(EMPTY_ORDER_FILTERS);
  const [searchParams] = useSearchParams();
  // Deep link from 회원관리: /admin/orders?order=<id> opens that order's detail.
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('order'));

  const results = filterOrders(orders.data, filters);
  const selected = orders.data.find((order) => order.id === selectedId) ?? null;
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody>
          <OrderFiltersBar filters={filters} onChange={setFilters} />
        </CardBody>
      </Card>
      <Card>
        <QueryBoundary
          status={orders.status}
          isEmpty={results.length === 0}
          onRetry={orders.refetch}
          emptyTitle={isFiltered ? '조건에 맞는 주문이 없어요' : '아직 주문 내역이 없어요'}
          emptyDescription={isFiltered ? '검색어나 필터를 바꿔 보세요.' : undefined}
          emptyAction={
            isFiltered ? (
              <Button
                variant={BUTTON_VARIANT.OUTLINE}
                onClick={() => setFilters(EMPTY_ORDER_FILTERS)}
              >
                필터 초기화
              </Button>
            ) : undefined
          }
          loadingLabel="주문 내역을 불러오는 중이에요"
        >
          <p
            className="border-b border-border px-5 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            총 {results.length}건
          </p>
          <DataTable caption="주문 내역">
            <thead>
              <tr>
                <Th>주문번호</Th>
                <Th>주문 일시</Th>
                <Th>메뉴</Th>
                <Th>방식</Th>
                <Th className="text-right">결제 금액</Th>
                <Th>결제 상태</Th>
                <Th>주문 상태</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      aria-label={`주문 ${order.orderNumber} 상세 보기`}
                      className="min-h-11 rounded-lg px-2 font-bold tabular-nums text-primary underline-offset-4 hover:underline"
                    >
                      {order.orderNumber}
                    </button>
                  </Td>
                  <Td className="tabular-nums">{formatDateTime(order.placedAt)}</Td>
                  <Td>{summarizeMenu(order)}</Td>
                  <Td>
                    <OrderTypeBadge type={order.orderType} />
                  </Td>
                  <Td className="text-right tabular-nums">{formatWon(order.paidAmount)}</Td>
                  <Td>
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </QueryBoundary>
      </Card>
      <Dialog
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `주문 ${selected.orderNumber}` : '주문 상세'}
        description="주문 상세 내용 (읽기 전용)"
        placement={DIALOG_PLACEMENT.RIGHT}
        widthClass="max-w-md"
      >
        {selected ? <OrderDetailBody order={selected} /> : null}
      </Dialog>
    </div>
  );
}
