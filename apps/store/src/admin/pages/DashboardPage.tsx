import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart3, Coins, Flame, ReceiptText, Store, TrendingUp } from 'lucide-react';
import { useOrdersQuery, useStoreStatus } from '@/data/queries';
import { PRIOR_DAILY_SALES } from '@/data/fixtures/admin';
import { buildDailySales, rankPopularItems, summarizeDay, summarizeMenu } from '@/domain/summaries';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { BUTTON_VARIANT, buttonClasses } from '@/ui/Button';
import { Card, CardBody, CardHeader, StatFigure } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { OrderStatusBadge } from '@/shared/badges';
import { formatCount, formatTime, formatWon, toDateInputValue } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { MS_PER_MINUTE } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { SalesChart } from '../SalesChart';

const RECENT_ORDER_LIMIT = 6;
const POPULAR_LIMIT = 5;
const DASHBOARD_TICK_MS = MS_PER_MINUTE;

function SummaryCard({
  icon,
  title,
  value,
  label,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  label: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5 text-sm font-semibold">
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        {title}
      </div>
      <div className="px-5">
        <StatFigure value={value} label={label} />
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const orders = useOrdersQuery();
  const status = useStoreStatus();
  const nowMs = useNow(DASHBOARD_TICK_MS);
  const today = summarizeDay(orders.data, toDateInputValue(new Date(nowMs).toISOString()));
  const popular = rankPopularItems(orders.data, POPULAR_LIMIT);
  const recent = [...orders.data]
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .slice(0, RECENT_ORDER_LIMIT);
  const sales = buildDailySales(PRIOR_DAILY_SALES, today.sales, nowMs);
  const top = popular[0];

  return (
    <QueryBoundary
      status={orders.status}
      isEmpty={orders.data.length === 0}
      onRetry={orders.refetch}
      emptyTitle="아직 집계할 주문이 없어요"
      emptyDescription="첫 주문이 들어오면 오늘의 매출이 이곳에 표시돼요."
      loadingLabel="대시보드를 불러오는 중이에요"
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Coins className="size-5" />}
            title="오늘 매출"
            value={formatWon(today.sales)}
            label="결제 완료 기준"
          />
          <SummaryCard
            icon={<ReceiptText className="size-5" />}
            title="오늘 주문 수"
            value={`${formatCount(today.orderCount)}건`}
            label="거절·취소 제외"
          />
          <SummaryCard
            icon={<TrendingUp className="size-5" />}
            title="평균 주문 금액"
            value={formatWon(today.averageAmount)}
            label="오늘 주문 기준"
          />
          <SummaryCard
            icon={<Flame className="size-5" />}
            title="인기 메뉴"
            value={top?.name ?? '-'}
            label={top ? `최근 판매 ${top.quantity}개` : '집계 데이터 없음'}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader icon={<BarChart3 className="size-5" />} title="일별 매출 (최근 7일)" />
            <CardBody>
              <SalesChart points={sales} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<Store className="size-5" />} title="현재 매장 상태" />
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">영업 상태</span>
                <Badge tone={status.isOpen ? BADGE_TONE.PRIMARY : BADGE_TONE.DANGER}>
                  {status.isOpen ? '영업 중' : '영업 종료'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">주문 접수</span>
                <Badge tone={status.isAcceptingOrders ? BADGE_TONE.SAGE : BADGE_TONE.WARNING}>
                  {status.isAcceptingOrders ? '접수 가능' : '일시 중지'}
                </Badge>
              </div>
              <Link
                to={ROUTES.ADMIN_SETTINGS}
                className={`${buttonClasses(BUTTON_VARIANT.OUTLINE)} mt-2 self-start`}
              >
                매장 설정에서 변경
              </Link>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              icon={<ReceiptText className="size-5" />}
              title="최근 주문"
              action={
                <Link
                  to={ROUTES.ADMIN_ORDERS}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-background"
                >
                  전체 보기
                </Link>
              }
            />
            <DataTable caption="최근 주문">
              <thead>
                <tr>
                  <Th>주문번호</Th>
                  <Th>시간</Th>
                  <Th>메뉴</Th>
                  <Th className="text-right">금액</Th>
                  <Th>상태</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <Tr key={order.id}>
                    <Td className="font-semibold tabular-nums">{order.orderNumber}</Td>
                    <Td className="tabular-nums">{formatTime(order.placedAt)}</Td>
                    <Td>{summarizeMenu(order)}</Td>
                    <Td className="text-right tabular-nums">{formatWon(order.paidAmount)}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </Card>
          <Card>
            <CardHeader icon={<Flame className="size-5" />} title="인기 메뉴 순위" />
            <ol className="divide-y divide-border px-5">
              {popular.map((item, index) => (
                <li key={item.name} className="flex items-center gap-3 py-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 font-medium">{item.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {item.quantity}개
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </QueryBoundary>
  );
}
