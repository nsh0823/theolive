import { formatDateTime, formatWon } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/domain/labels';
import { ORDER_STATUS, type Order } from '@/domain/models';
import { OrderStatusBadge, OrderTypeBadge, PaymentStatusBadge, TemperatureBadge } from './badges';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Read-only order detail shared by Store Web (order drawer) and Store Admin (order history). */
export function OrderDetailBody({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <OrderTypeBadge type={order.orderType} />
        <span className="text-sm text-muted-foreground">{formatDateTime(order.placedAt)}</span>
      </div>

      <section aria-labelledby="order-lines-heading">
        <h3 id="order-lines-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
          주문 메뉴
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {order.lines.map((line) => (
            <li
              key={`${line.menuItemId}-${line.temperature}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{line.name}</span>
                <TemperatureBadge temperature={line.temperature} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold tabular-nums">× {line.quantity}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatWon(line.unitPrice * line.quantity)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="order-note-heading">
        <h3 id="order-note-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
          고객 요청 사항
        </h3>
        <p className="rounded-xl bg-cream px-4 py-3 text-sm">{order.note ?? '요청 사항 없음'}</p>
      </section>

      {order.status === ORDER_STATUS.REJECTED ? (
        <section aria-labelledby="order-reject-heading">
          <h3
            id="order-reject-heading"
            className="mb-2 text-sm font-semibold text-muted-foreground"
          >
            거절 사유
          </h3>
          <p className="rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {order.rejectReason ?? '사유 미기록'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            환불 처리 방식은 정책 확정 전입니다. 결제 상태는 서버 처리 결과를 따릅니다.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="order-pay-heading">
        <h3 id="order-pay-heading" className="mb-1 text-sm font-semibold text-muted-foreground">
          결제 정보
        </h3>
        <dl className="divide-y divide-border">
          <Row label="메뉴 금액" value={formatWon(order.menuAmount)} />
          {order.couponDiscount > 0 ? (
            <Row label="쿠폰 할인" value={`-${formatWon(order.couponDiscount)}`} />
          ) : null}
          {order.pointsUsed > 0 ? (
            <Row label="쿠폰 포인트 사용" value={`-${formatWon(order.pointsUsed)}`} />
          ) : null}
          <Row label="결제 수단" value={PAYMENT_METHOD_LABEL[order.paymentMethod]} />
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm font-semibold">결제 금액</dt>
            <dd className="text-xl font-bold tabular-nums">{formatWon(order.paidAmount)}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm text-muted-foreground">결제 상태</dt>
            <dd>
              <PaymentStatusBadge status={order.paymentStatus} />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
