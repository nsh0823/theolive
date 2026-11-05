import { POINT_CODE_DISPLAY_STATUS, type PointCodeDisplayStatus } from '@theolive/api';
import { ORDER_REJECT_REASON, type OrderRejectReason } from '@theolive/types';
import {
  COUPON_STATUS,
  NOTICE_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  STAFF_PERMISSION,
  STAMP_EARN_MODE,
  type CouponStatus,
  type NoticeStatus,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type StaffPermission,
  type StampEarnMode,
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
  [PAYMENT_METHOD.NONE]: '결제 없음 (0원)',
};

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  [COUPON_STATUS.AVAILABLE]: '사용 가능',
  [COUPON_STATUS.USED]: '사용 완료',
  [COUPON_STATUS.EXPIRED]: '만료',
};

export const POINT_CODE_STATUS_LABEL: Record<PointCodeDisplayStatus, string> = {
  [POINT_CODE_DISPLAY_STATUS.UNUSED]: '미등록',
  [POINT_CODE_DISPLAY_STATUS.REGISTERED]: '등록·사용 중',
  [POINT_CODE_DISPLAY_STATUS.EXHAUSTED]: '전액 사용',
  [POINT_CODE_DISPLAY_STATUS.EXPIRED]: '만료',
  [POINT_CODE_DISPLAY_STATUS.VOID]: '무효',
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
  [STAMP_EARN_MODE.PER_ORDER]: '주문 1건당 고정 개수',
  [STAMP_EARN_MODE.PER_AMOUNT]: '결제 금액 기준',
};

export const WEEKDAY_LABEL = ['월', '화', '수', '목', '금', '토', '일'] as const;

const LOGIN_PROVIDER_LABEL: Record<LoginProvider, string> = {
  [LOGIN_PROVIDER.KAKAO]: '카카오',
  [LOGIN_PROVIDER.NAVER]: '네이버',
  [LOGIN_PROVIDER.GOOGLE]: 'Google',
  [LOGIN_PROVIDER.APPLE]: 'Apple',
  [LOGIN_PROVIDER.EMAIL]: '이메일',
};

/** The server sends the provider as an uppercase string; an unknown one is shown as it is. */
export function loginProviderLabel(provider: string): string {
  const known = Object.values(LOGIN_PROVIDER).find((value) => value === provider);
  return known ? LOGIN_PROVIDER_LABEL[known] : provider;
}

/** Olive Stamps ledger kinds (`stamp_tx_kind`). */
const STAMP_KIND_LABEL: Record<string, string> = {
  EARN: '적립',
  REDEEM: '쿠폰 교환',
  EARN_REVERSAL: '적립 취소',
  REDEEM_RESTORE: '교환 취소',
  EXPIRE: '소멸',
  FORFEIT: '탈퇴 소멸',
  ADJUST: '조정',
};

/** Coupon Points ledger kinds (`point_tx_kind`). */
const POINT_KIND_LABEL: Record<string, string> = {
  REGISTER: '코드 등록',
  USE: '사용',
  REFUND_RESTORE: '환불 복원',
  EXPIRE: '소멸',
  FORFEIT: '탈퇴 소멸',
  ADJUST: '조정',
};

export const stampKindLabel = (kind: string): string => STAMP_KIND_LABEL[kind] ?? kind;
export const pointKindLabel = (kind: string): string => POINT_KIND_LABEL[kind] ?? kind;

/** Reject reasons staff can pick (OQ-10); the codes are the ones `staff_transition_order` accepts. */
export const REJECT_REASON_LABEL: Record<OrderRejectReason, string> = {
  [ORDER_REJECT_REASON.SOLD_OUT]: '재고 부족 (품절)',
  [ORDER_REJECT_REASON.CLOSING]: '영업 종료',
  [ORDER_REJECT_REASON.TOO_BUSY]: '매장 사정 (혼잡)',
  [ORDER_REJECT_REASON.OTHER]: '기타 (직접 입력)',
};
