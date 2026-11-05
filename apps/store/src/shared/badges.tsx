import {
  Ban,
  BellRing,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Coffee,
  Flame,
  PackageCheck,
  Snowflake,
  Store,
  Undo2,
  UtensilsCrossed,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge, BADGE_TONE, type BadgeTone } from '@/ui/Badge';
import {
  COUPON_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_STATUS,
  TEMPERATURE,
  type CouponStatus,
  type OrderStatus,
  type OrderType,
  type PaymentStatus,
  type Temperature,
} from '@/domain/models';
import {
  COUPON_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
} from '@/domain/labels';

const ICON_CLASS = 'size-3.5';

const ORDER_STATUS_STYLE: Record<OrderStatus, { tone: BadgeTone; Icon: LucideIcon }> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { tone: BADGE_TONE.NEUTRAL, Icon: Clock },
  [ORDER_STATUS.PAID]: { tone: BADGE_TONE.PRIMARY, Icon: BellRing },
  [ORDER_STATUS.ACCEPTED]: { tone: BADGE_TONE.SAGE, Icon: ClipboardCheck },
  [ORDER_STATUS.PREPARING]: { tone: BADGE_TONE.WARNING, Icon: Coffee },
  [ORDER_STATUS.READY]: { tone: BADGE_TONE.SAGE, Icon: PackageCheck },
  [ORDER_STATUS.COMPLETED]: { tone: BADGE_TONE.NEUTRAL, Icon: CheckCheck },
  [ORDER_STATUS.REJECTED]: { tone: BADGE_TONE.DANGER, Icon: Ban },
  [ORDER_STATUS.CANCELLED]: { tone: BADGE_TONE.DANGER, Icon: XCircle },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { tone, Icon } = ORDER_STATUS_STYLE[status];
  return (
    <Badge tone={tone} icon={<Icon className={ICON_CLASS} aria-hidden="true" />}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

const PAYMENT_STYLE: Record<PaymentStatus, { tone: BadgeTone; Icon: LucideIcon }> = {
  [PAYMENT_STATUS.READY]: { tone: BADGE_TONE.NEUTRAL, Icon: Clock },
  [PAYMENT_STATUS.PAID]: { tone: BADGE_TONE.SAGE, Icon: CircleCheck },
  [PAYMENT_STATUS.FAILED]: { tone: BADGE_TONE.DANGER, Icon: CircleAlert },
  [PAYMENT_STATUS.CANCELLED]: { tone: BADGE_TONE.DANGER, Icon: XCircle },
  [PAYMENT_STATUS.PARTIAL_REFUNDED]: { tone: BADGE_TONE.WARNING, Icon: Undo2 },
  [PAYMENT_STATUS.REFUNDED]: { tone: BADGE_TONE.WARNING, Icon: Undo2 },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { tone, Icon } = PAYMENT_STYLE[status];
  return (
    <Badge tone={tone} icon={<Icon className={ICON_CLASS} aria-hidden="true" />}>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function OrderTypeBadge({ type }: { type: OrderType }) {
  const Icon = type === ORDER_TYPE.DINE_IN ? UtensilsCrossed : Store;
  return (
    <Badge tone={BADGE_TONE.NEUTRAL} icon={<Icon className={ICON_CLASS} aria-hidden="true" />}>
      {ORDER_TYPE_LABEL[type]}
    </Badge>
  );
}

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const isHot = temperature === TEMPERATURE.HOT;
  const Icon = isHot ? Flame : Snowflake;
  return (
    <Badge
      tone={isHot ? BADGE_TONE.WARNING : BADGE_TONE.SAGE}
      icon={<Icon className={ICON_CLASS} aria-hidden="true" />}
    >
      {temperature}
    </Badge>
  );
}

const COUPON_TONE: Record<CouponStatus, BadgeTone> = {
  [COUPON_STATUS.AVAILABLE]: BADGE_TONE.SAGE,
  [COUPON_STATUS.USED]: BADGE_TONE.NEUTRAL,
  [COUPON_STATUS.EXPIRED]: BADGE_TONE.DANGER,
};

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  return <Badge tone={COUPON_TONE[status]}>{COUPON_STATUS_LABEL[status]}</Badge>;
}
