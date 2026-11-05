import { MS_PER_DAY } from '@/lib/time';
import { maskEmail, maskPhone } from '@/domain/masking';
import {
  LOGIN_PROVIDER,
  POINT_LEDGER_KIND,
  STAMP_LEDGER_KIND,
  type LedgersByMember,
  type LoginProvider,
  type Member,
  type PointLedgerEntry,
  type StampLedgerEntry,
} from '@/domain/memberModels';
import type { Order } from '@/domain/models';
import { isSalesOrder } from '@/domain/summaries';

const { KAKAO, NAVER, GOOGLE, APPLE } = LOGIN_PROVIDER;

export type MemberSeed = {
  id: string;
  nickname: string;
  /** RAW test data. Only this module may hold it; everything exported to the UI is masked. */
  email: string | null;
  phone: string | null;
  provider: LoginProvider;
  joinedDaysAgo: number;
  /** Stamps earned before the fixture orders. */
  stampBonus: number;
  /** Whether the member already exchanged 10 stamps for a coupon. */
  exchanged: boolean;
  /** Coupon Points registered by code (won). */
  pointsGranted: number;
};

const s = (
  id: string,
  nickname: string,
  email: string | null,
  phone: string | null,
  provider: LoginProvider,
  joinedDaysAgo: number,
  stampBonus: number,
  exchanged: boolean,
  pointsGranted: number,
): MemberSeed => ({
  id,
  nickname,
  email,
  phone,
  provider,
  joinedDaysAgo,
  stampBonus,
  exchanged,
  pointsGranted,
});

export const MEMBER_SEEDS: MemberSeed[] = [
  s('m01', '올리브러버', 'jihoon.park82@gmail.com', '010-2345-6781', KAKAO, 210, 14, true, 0),
  s('m02', '새벽커피', 'dawncoffee@naver.com', '010-8821-4402', NAVER, 150, 6, false, 5000),
  s('m03', '라떼한잔', 'latte.hanjan@kakao.com', '010-5567-9034', KAKAO, 320, 22, true, 20000),
  s('m04', '하늘정원', 'skygarden77@gmail.com', '010-3321-7788', GOOGLE, 95, 3, false, 0),
  s('m05', '말랑콩', 'malrangkong@naver.com', '010-9012-3456', NAVER, 60, 2, false, 0),
  s('m06', '푸른숲', 'blueforest01@gmail.com', '010-7410-2589', GOOGLE, 180, 9, false, 3000),
  s('m07', '단비', null, '010-4455-8120', APPLE, 45, 1, false, 0),
  s('m08', '소금빵좋아', 'saltbread@kakao.com', '010-6637-1290', KAKAO, 130, 5, false, 0),
  s('m09', '민트초코', 'mintchoco.k@naver.com', '010-1590-7531', NAVER, 75, 4, false, 2000),
  s('m10', '은총', 'eunchong1234@gmail.com', '010-3698-1470', GOOGLE, 28, 0, false, 0),
  s('m11', '아침햇살', 'morningsun@naver.com', '+82 10 7788 9900', NAVER, 260, 11, false, 0),
  s('m12', '카페인중독', 'caffeine.addict@kakao.com', '010-2020-3030', KAKAO, 90, 7, false, 0),
  s('m13', '봄날', 'springday@gmail.com', null, GOOGLE, 120, 8, false, 0),
  s('m14', '동그라미', 'circle.o@naver.com', '010-4141-5252', NAVER, 200, 3, false, 0),
  s('m15', '바람결', 'windy.gyeol@kakao.com', '010-8080-9191', KAKAO, 35, 1, false, 0),
  s('m16', '초록잎', 'greenleaf@gmail.com', '010-1357-2468', GOOGLE, 70, 2, false, 0),
  s('m17', '오후세시', null, '010-9753-1864', APPLE, 55, 2, false, 0),
  s('m18', '느티나무', 'zelkova@naver.com', '011-234-5678', NAVER, 340, 5, false, 0),
  s('m19', '곰돌이', 'gomdori55@kakao.com', '010-1212-3434', KAKAO, 8, 0, false, 0),
  s('m20', '별빛', 'starlight@gmail.com', '010-5656-7878', GOOGLE, 6, 0, false, 0),
  s('m21', '구름빵', 'cloudbread@naver.com', '010-2468-1357', NAVER, 5, 0, false, 0),
  s('m22', '사과나무', null, null, APPLE, 4, 0, false, 0),
  s('m23', '노을', 'sunset.glow@kakao.com', '010-7979-8686', KAKAO, 3, 0, false, 0),
  s('m24', '호두과자', 'walnut@gmail.com', '010-6464-2323', GOOGLE, 2, 0, false, 0),
  s('m25', '평안', 'pyeongan@naver.com', '010-1111-2222', NAVER, 1, 0, false, 0),
];

/** Masking happens here, once; the UI only ever receives masked members. */
export function createMembers(nowMs: number = Date.now()): Member[] {
  return MEMBER_SEEDS.map((seed) => ({
    id: seed.id,
    nickname: seed.nickname,
    maskedEmail: maskEmail(seed.email),
    maskedPhone: maskPhone(seed.phone),
    provider: seed.provider,
    joinedAt: new Date(nowMs - seed.joinedDaysAgo * MS_PER_DAY).toISOString(),
  }));
}

const STAMPS_PER_COUPON = 10;

function afterJoin(member: Member): string {
  return new Date(new Date(member.joinedAt).getTime() + MS_PER_DAY).toISOString();
}

/** Stamp ledger: earlier earnings, one stamp per paid order, and an optional 10-stamp exchange. */
export function createStampLedgers(
  members: Member[],
  orders: readonly Order[],
): LedgersByMember<StampLedgerEntry> {
  const result: LedgersByMember<StampLedgerEntry> = {};
  for (const seed of MEMBER_SEEDS) {
    const member = members.find((m) => m.id === seed.id);
    if (!member) continue;
    const rows: StampLedgerEntry[] = [];
    if (seed.stampBonus > 0) {
      rows.push({
        id: `${seed.id}-sb`,
        asset: 'STAMP',
        kind: STAMP_LEDGER_KIND.EARN,
        label: '이전 주문 적립',
        amount: seed.stampBonus,
        at: afterJoin(member),
      });
    }
    for (const order of orders.filter((o) => o.memberId === seed.id && isSalesOrder(o))) {
      rows.push({
        id: `${seed.id}-${order.id}`,
        asset: 'STAMP',
        kind: STAMP_LEDGER_KIND.EARN,
        label: `주문 적립 (${order.orderNumber})`,
        amount: 1,
        at: order.placedAt,
      });
    }
    if (seed.exchanged) {
      rows.push({
        id: `${seed.id}-ex`,
        asset: 'STAMP',
        kind: STAMP_LEDGER_KIND.USE,
        label: '쿠폰 교환 (아메리카노 또는 라떼)',
        amount: -STAMPS_PER_COUPON,
        at: afterJoin(member),
      });
    }
    result[seed.id] = rows.sort((a, b) => b.at.localeCompare(a.at));
  }
  return result;
}

/** Point ledger: code registrations plus the points each order actually used. */
export function createPointLedgers(
  members: Member[],
  orders: readonly Order[],
): LedgersByMember<PointLedgerEntry> {
  const result: LedgersByMember<PointLedgerEntry> = {};
  for (const seed of MEMBER_SEEDS) {
    const member = members.find((m) => m.id === seed.id);
    if (!member) continue;
    const rows: PointLedgerEntry[] = [];
    if (seed.pointsGranted > 0) {
      rows.push({
        id: `${seed.id}-pg`,
        asset: 'POINT',
        kind: POINT_LEDGER_KIND.EARN,
        label: '포인트 코드 등록',
        amount: seed.pointsGranted,
        at: afterJoin(member),
      });
    }
    for (const order of orders.filter((o) => o.memberId === seed.id && o.pointsUsed > 0)) {
      rows.push({
        id: `${seed.id}-${order.id}`,
        asset: 'POINT',
        kind: POINT_LEDGER_KIND.USE,
        label: `주문 결제 사용 (${order.orderNumber})`,
        amount: -order.pointsUsed,
        at: order.placedAt,
      });
    }
    result[seed.id] = rows.sort((a, b) => b.at.localeCompare(a.at));
  }
  return result;
}
