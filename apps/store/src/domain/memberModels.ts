// Store Admin 회원관리 view-models. Everything here is already masked: raw email/phone never enter the UI.

export const LOGIN_PROVIDER = {
  KAKAO: 'KAKAO',
  NAVER: 'NAVER',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
} as const;
export type LoginProvider = (typeof LOGIN_PROVIDER)[keyof typeof LOGIN_PROVIDER];

export type Member = {
  id: string;
  nickname: string;
  /** Pre-masked, e.g. `hong***@gmail.com`. `null` when the provider shared no email. */
  maskedEmail: string | null;
  /** Pre-masked, e.g. `010-****-5678`. `null` when no phone is on file. */
  maskedPhone: string | null;
  provider: LoginProvider;
  /** ISO 8601. */
  joinedAt: string;
};

/** Olive Stamps ledger row (counts). Separate type from point rows on purpose. */
export const STAMP_LEDGER_KIND = { EARN: 'EARN', USE: 'USE' } as const;
export type StampLedgerKind = (typeof STAMP_LEDGER_KIND)[keyof typeof STAMP_LEDGER_KIND];
export type StampLedgerEntry = {
  id: string;
  asset: 'STAMP';
  kind: StampLedgerKind;
  label: string;
  /** Signed number of stamps. */
  amount: number;
  at: string;
};

/** Coupon Points ledger row (won). */
export const POINT_LEDGER_KIND = { EARN: 'EARN', USE: 'USE', CANCEL: 'CANCEL' } as const;
export type PointLedgerKind = (typeof POINT_LEDGER_KIND)[keyof typeof POINT_LEDGER_KIND];
export type PointLedgerEntry = {
  id: string;
  asset: 'POINT';
  kind: PointLedgerKind;
  label: string;
  /** Signed won amount. */
  amount: number;
  at: string;
};

export type LedgersByMember<T> = Record<string, T[]>;

export type MemberStats = {
  orderCount: number;
  totalSpent: number;
  /** ISO timestamp of the newest order, or `null` when the member never ordered. */
  lastOrderAt: string | null;
};
