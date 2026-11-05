import {
  COUPON_STATUS,
  NOTICE_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  POINT_CODE_STATUS,
  STAFF_PERMISSION,
  STAMP_EARN_MODE,
  STAMP_EARN_TIMING,
  type CouponStatus,
  type NoticeStatus,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type PointCodeStatus,
  type StaffPermission,
  type StampEarnMode,
  type StampEarnTiming,
} from './models';
import { LOGIN_PROVIDER, type LoginProvider } from './memberModels';

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  [ORDER_TYPE.DINE_IN]: '매장',
  [ORDER_TYPE.TAKEOUT]: '포장',
};

/** Staff-facing wording (brief). The customer app says 접수 대기 / 제조 중 / 제조 완료 for the same states. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: '결제 대기',
  [ORDER_STATUS.PAID]: '신규 주문',
  [ORDER_STATUS.ACCEPTED]: '접수 완료',
  [ORDER_STATUS.PREPARING]: '준비 중',
  [ORDER_STATUS.READY]: '준비 완료',
  [ORDER_STATUS.COMPLETED]: '수령 완료',
  [ORDER_STATUS.REJECTED]: '주문 거절',
  [ORDER_STATUS.CANCELLED]: '주문 취소',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.READY]: '결제 준비',
  [PAYMENT_STATUS.PAID]: '결제 완료',
  [PAYMENT_STATUS.FAILED]: '결제 실패',
  [PAYMENT_STATUS.CANCELLED]: '결제 취소',
  [PAYMENT_STATUS.PARTIAL_REFUNDED]: '부분 환불',
  [PAYMENT_STATUS.REFUNDED]: '전체 환불',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.KAKAO_PAY]: '카카오페이',
  [PAYMENT_METHOD.NAVER_PAY]: '네이버페이',
  [PAYMENT_METHOD.TOSS_PAY]: '토스페이',
  [PAYMENT_METHOD.CARD]: '신용·체크카드',
};

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  [COUPON_STATUS.AVAILABLE]: '사용 가능',
  [COUPON_STATUS.USED]: '사용 완료',
  [COUPON_STATUS.EXPIRED]: '만료',
};

export const POINT_CODE_STATUS_LABEL: Record<PointCodeStatus, string> = {
  [POINT_CODE_STATUS.UNUSED]: '미등록',
  [POINT_CODE_STATUS.REGISTERED]: '등록·사용 중',
  [POINT_CODE_STATUS.EXHAUSTED]: '전액 사용',
  [POINT_CODE_STATUS.EXPIRED]: '만료',
};

export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
  [NOTICE_STATUS.PUBLISHED]: '게시 중',
  [NOTICE_STATUS.UNPUBLISHED]: '비공개',
};

export const STAFF_PERMISSION_LABEL: Record<StaffPermission, string> = {
  [STAFF_PERMISSION.PROCESS_ORDERS]: '주문 처리',
  [STAFF_PERMISSION.MANAGE_OPERATIONS]: '품절·운영 설정',
};

export const STAMP_EARN_MODE_LABEL: Record<StampEarnMode, string> = {
  [STAMP_EARN_MODE.PER_ORDER]: '주문 1건당 1개',
  [STAMP_EARN_MODE.PER_AMOUNT]: '결제 금액 기준',
};

export const STAMP_EARN_TIMING_LABEL: Record<StampEarnTiming, string> = {
  [STAMP_EARN_TIMING.PAID]: '결제 완료 시',
  [STAMP_EARN_TIMING.ACCEPTED]: '매장 접수 시',
  [STAMP_EARN_TIMING.COMPLETED]: '수령 완료 시',
};

export const WEEKDAY_LABEL = ['월', '화', '수', '목', '금', '토', '일'] as const;

export const LOGIN_PROVIDER_LABEL: Record<LoginProvider, string> = {
  [LOGIN_PROVIDER.KAKAO]: '카카오',
  [LOGIN_PROVIDER.NAVER]: '네이버',
  [LOGIN_PROVIDER.GOOGLE]: 'Google',
  [LOGIN_PROVIDER.APPLE]: 'Apple',
};
