import {
  ORDER_STATUS,
  ORDER_TYPE,
  TEMPERATURE,
  type LedgerKind,
  type OrderStatus,
  type OrderType,
  type Temperature,
} from '@/models';

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  [TEMPERATURE.HOT]: 'HOT',
  [TEMPERATURE.ICE]: 'ICE',
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  [ORDER_TYPE.DINE_IN]: '매장 식사',
  [ORDER_TYPE.TAKEOUT]: '포장',
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

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  EARN: '적립',
  USE: '사용',
  CANCEL: '취소',
};
