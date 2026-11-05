import {
  NOTIFICATION_KIND,
  ORDER_STATUS,
  PAYMENT_METHOD,
  ORDER_TYPE,
  TEMPERATURE,
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

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  EARN: '적립',
  USE: '사용',
  CANCEL: '취소',
};
