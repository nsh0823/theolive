// Store Admin 회원관리 labels. The member data itself comes from the server (`@theolive/api` members) already masked.

export const LOGIN_PROVIDER = {
  KAKAO: 'KAKAO',
  NAVER: 'NAVER',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  /** Email and password: local development accounts only (OQ-3). */
  EMAIL: 'EMAIL',
} as const;
export type LoginProvider = (typeof LOGIN_PROVIDER)[keyof typeof LOGIN_PROVIDER];
