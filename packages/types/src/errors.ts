/**
 * Application error codes. SQL RPCs raise `P0001` with one of these as the message; Edge Functions return
 * `{ error: { code, message } }`. Defined once here; each backend phase adds the codes it introduces.
 */
export const APP_ERROR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  APPEND_ONLY: 'APPEND_ONLY',
  LAST_ADMIN: 'LAST_ADMIN',
  CANNOT_CHANGE_SELF_ROLE: 'CANNOT_CHANGE_SELF_ROLE',
  ALREADY_STAFF: 'ALREADY_STAFF',
  ADMIN_EXISTS: 'ADMIN_EXISTS',
  STAFF_ACCOUNT_NOT_ALLOWED: 'STAFF_ACCOUNT_NOT_ALLOWED',
  // Phase (c): checkout, orders and payments.
  STORE_CLOSED: 'STORE_CLOSED',
  NOT_ACCEPTING_ORDERS: 'NOT_ACCEPTING_ORDERS',
  EMPTY_CART: 'EMPTY_CART',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  ITEM_UNAVAILABLE: 'ITEM_UNAVAILABLE',
  ITEM_SOLD_OUT: 'ITEM_SOLD_OUT',
  INVALID_TEMPERATURE: 'INVALID_TEMPERATURE',
  NOTE_TOO_LONG: 'NOTE_TOO_LONG',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  STALE_STATUS: 'STALE_STATUS',
  REASON_REQUIRED: 'REASON_REQUIRED',
  PAYMENT_NOT_APPROVED: 'PAYMENT_NOT_APPROVED',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  PAYMENT_PROVIDER_UNAVAILABLE: 'PAYMENT_PROVIDER_UNAVAILABLE',
  NOT_REFUNDABLE: 'NOT_REFUNDABLE',
  REFUND_FAILED: 'REFUND_FAILED',
  TEST_PG_DISABLED: 'TEST_PG_DISABLED',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  // Phase (d): Olive Stamps and reward coupons.
  INSUFFICIENT_STAMPS: 'INSUFFICIENT_STAMPS',
  REWARD_INACTIVE: 'REWARD_INACTIVE',
  COUPON_NOT_USABLE: 'COUPON_NOT_USABLE',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  // Phase (e): Coupon Points.
  POINTS_EXCEED_BALANCE: 'POINTS_EXCEED_BALANCE',
  POINTS_EXCEED_PAYABLE: 'POINTS_EXCEED_PAYABLE',
  POINTS_BELOW_MINIMUM: 'POINTS_BELOW_MINIMUM',
  CODE_INVALID: 'CODE_INVALID',
  CODE_ALREADY_REGISTERED: 'CODE_ALREADY_REGISTERED',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_VOID: 'CODE_VOID',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  // Phase (f): account deletion.
  ACTIVE_ORDER_EXISTS: 'ACTIVE_ORDER_EXISTS',
  INTERNAL: 'INTERNAL',
} as const;

export type AppErrorCode = (typeof APP_ERROR)[keyof typeof APP_ERROR];

const APP_ERROR_CODES: readonly string[] = Object.values(APP_ERROR);

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && APP_ERROR_CODES.includes(value);
}

/** Plain-language messages shown to users (Korean UI). */
export const APP_ERROR_MESSAGE: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: '로그인이 필요해요.',
  FORBIDDEN: '이 작업을 할 권한이 없어요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없어요.',
  INVALID_INPUT: '입력한 내용을 확인해 주세요.',
  APPEND_ONLY: '기록은 수정하거나 삭제할 수 없어요.',
  LAST_ADMIN: '마지막 관리자는 해제하거나 비활성화할 수 없어요.',
  CANNOT_CHANGE_SELF_ROLE: '본인의 역할은 직접 바꿀 수 없어요.',
  ALREADY_STAFF: '이미 등록된 직원이에요.',
  ADMIN_EXISTS: '이미 관리자가 있어요.',
  STAFF_ACCOUNT_NOT_ALLOWED:
    '직원 계정은 고객 앱에서 사용할 수 없어요. 고객 계정으로 로그인해 주세요.',
  STORE_CLOSED: '지금은 매장이 영업 중이 아니에요.',
  NOT_ACCEPTING_ORDERS: '지금은 주문을 받지 않아요. 잠시 후 다시 시도해 주세요.',
  EMPTY_CART: '장바구니가 비어 있어요.',
  INVALID_QUANTITY: '수량은 한 메뉴당 1개에서 20개까지 담을 수 있어요.',
  ITEM_UNAVAILABLE: '지금은 주문할 수 없는 메뉴가 있어요.',
  ITEM_SOLD_OUT: '품절된 메뉴가 있어요.',
  INVALID_TEMPERATURE: '선택할 수 없는 온도예요.',
  NOTE_TOO_LONG: '요청사항은 100자 이하로 입력해 주세요.',
  IDEMPOTENCY_CONFLICT: '이미 처리된 주문 요청이에요. 처음부터 다시 시도해 주세요.',
  INVALID_TRANSITION: '현재 상태에서는 처리할 수 없는 작업이에요.',
  STALE_STATUS: '주문 상태가 이미 바뀌었어요. 새로고침했어요.',
  REASON_REQUIRED: '사유를 입력해 주세요.',
  PAYMENT_NOT_APPROVED: '결제가 승인되지 않았어요.',
  PAYMENT_AMOUNT_MISMATCH: '결제 금액이 주문 금액과 달라 취소했어요.',
  PAYMENT_EXPIRED: '결제 가능 시간이 지나 주문이 취소되었어요. 결제 금액은 환불돼요.',
  PAYMENT_PROVIDER_UNAVAILABLE: '결제 서비스에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
  NOT_REFUNDABLE: '환불할 수 없는 주문이에요.',
  REFUND_FAILED: '환불 처리에 실패했어요. 잠시 후 다시 시도해 주세요.',
  TEST_PG_DISABLED: '테스트 결제가 꺼져 있어요.',
  WEBHOOK_SIGNATURE_INVALID: '서명이 올바르지 않아요.',
  INSUFFICIENT_STAMPS: '스탬프가 부족해요.',
  REWARD_INACTIVE: '지금은 교환할 수 없는 쿠폰이에요.',
  COUPON_NOT_USABLE: '이 주문에는 사용할 수 없는 쿠폰이에요.',
  COUPON_EXPIRED: '유효기간이 지난 쿠폰이에요.',
  POINTS_EXCEED_BALANCE: '사용할 수 있는 포인트보다 많아요.',
  POINTS_EXCEED_PAYABLE: '결제 금액보다 많은 포인트는 사용할 수 없어요.',
  POINTS_BELOW_MINIMUM: '최소 사용 금액보다 적어서 포인트를 사용할 수 없어요.',
  CODE_INVALID: '올바르지 않은 코드예요. 코드를 다시 확인해 주세요.',
  CODE_ALREADY_REGISTERED: '이미 사용된 코드예요.',
  CODE_EXPIRED: '유효기간이 지난 코드예요.',
  CODE_VOID: '사용할 수 없는 코드예요. 매장에 문의해 주세요.',
  TOO_MANY_ATTEMPTS: '코드를 여러 번 잘못 입력했어요. 잠시 후 다시 시도해 주세요.',
  ACTIVE_ORDER_EXISTS:
    '진행 중인 주문이 있어서 탈퇴할 수 없어요. 주문이 끝난 뒤에 다시 시도해 주세요.',
  INTERNAL: '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

/** Reads the app error code from a Supabase/PostgREST error or an Edge Function error body. */
export function toAppErrorCode(error: unknown): AppErrorCode {
  if (typeof error === 'object' && error !== null) {
    const message: unknown = 'message' in error ? error.message : undefined;
    if (isAppErrorCode(message)) return message;
    const code: unknown = 'code' in error ? error.code : undefined;
    if (isAppErrorCode(code)) return code;
  }
  return APP_ERROR.INTERNAL;
}
