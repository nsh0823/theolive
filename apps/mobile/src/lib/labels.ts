import type { PaymentStatus } from '@theolive/types';

import { formatWon } from '@/lib/format';
import {
  NOTIFICATION_KIND,
  ORDER_STATUS,
  PAYMENT_METHOD,
  ORDER_TYPE,
  TEMPERATURE,
  type CouponBenefit,
  type LedgerKind,
  type NotificationKind,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type Temperature,
} from '@/models';

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  [TEMPERATURE.HOT]: 'HOT',
  [TEMPERATURE.ICE]: 'ICE',
};

/** Label for a line's temperature; empty for items that have no temperature choice. */
export function temperatureText(temperature: Temperature | null): string {
  return temperature === null ? '' : TEMPERATURE_LABEL[temperature];
}

/** "HOT | 2개", or just "2개" for items without a temperature choice. */
export function lineSummary(temperature: Temperature | null, quantity: number): string {
  return [temperatureText(temperature), `${quantity}개`].filter((part) => part !== '').join(' | ');
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  [ORDER_TYPE.DINE_IN]: '매장 이용',
  [ORDER_TYPE.TAKEOUT]: '포장 (TO-GO)',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: '결제 대기',
  [ORDER_STATUS.PAID]: '접수 대기',
  [ORDER_STATUS.ACCEPTED]: '주문 접수',
  [ORDER_STATUS.PREPARING]: '제조 중',
  [ORDER_STATUS.READY]: '제조 완료',
  [ORDER_STATUS.COMPLETED]: '수령 완료',
  [ORDER_STATUS.REJECTED]: '주문 거절',
  [ORDER_STATUS.CANCELLED]: '주문 취소',
};

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  [NOTIFICATION_KIND.ORDER]: '주문',
  [NOTIFICATION_KIND.PAYMENT]: '결제',
  [NOTIFICATION_KIND.STAMP]: '스탬프',
  [NOTIFICATION_KIND.COUPON]: '쿠폰',
  [NOTIFICATION_KIND.POINT]: '포인트',
  [NOTIFICATION_KIND.NOTICE]: '공지',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.KAKAO_PAY]: '카카오페이',
  [PAYMENT_METHOD.NAVER_PAY]: '네이버페이',
  [PAYMENT_METHOD.TOSS_PAY]: '토스페이',
  [PAYMENT_METHOD.CARD]: '신용·체크카드 (기타 결제)',
};

/** Short benefit text on a coupon: a fixed amount off, or a free drink (up to the cap when the rule has one). */
export function couponBenefitLabel(benefit: CouponBenefit): string {
  if (benefit.benefitType === 'FIXED_AMOUNT') {
    return `${formatWon(benefit.discountAmount ?? 0)} 할인`;
  }
  return benefit.discountAmount === null
    ? '1잔 무료'
    : `최대 ${formatWon(benefit.discountAmount)} 무료`;
}

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  EARN: '적립',
  USE: '사용',
  CANCEL: '취소',
  EXPIRE: '소멸',
};

/** Staff reject reasons (OQ-10); `OTHER` shows the free text staff wrote. */
export const REJECT_REASON_LABEL: Record<string, string> = {
  SOLD_OUT: '재료가 소진되었어요',
  CLOSING: '영업이 종료되었어요',
  TOO_BUSY: '매장이 많이 붐벼요',
  OTHER: '매장 사정',
};

export function rejectReasonText(code: string | null, freeText: string | null): string | null {
  if (code === null) return freeText;
  if (code === 'OTHER' && freeText) return freeText;
  return REJECT_REASON_LABEL[code] ?? freeText;
}

/** Refund progress for a cancelled or rejected order (the payment moves independently of the order). */
export function refundNote(status: OrderStatus, paymentStatus: PaymentStatus): string | null {
  if (status !== ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.REJECTED) return null;
  if (paymentStatus === 'PAID') return '환불 진행 중';
  if (paymentStatus === 'REFUNDED') return '환불 완료';
  return null;
}

/** Every payment method is a test payment until a real PG is contracted (OQ-21). */
export const TEST_PAYMENT_LABEL = '테스트 결제';

const LOGIN_PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  google: '구글',
  apple: '애플',
  naver: '네이버',
  email: '이메일',
};

/** Korean name of the sign-in method (from the auth session's `app_metadata.provider`). */
export function loginProviderLabel(provider: unknown): string {
  return typeof provider === 'string' ? (LOGIN_PROVIDER_LABEL[provider] ?? provider) : '';
}
