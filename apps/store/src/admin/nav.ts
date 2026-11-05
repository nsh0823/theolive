import {
  Coins,
  LayoutDashboard,
  Leaf,
  Megaphone,
  Receipt,
  Settings,
  UsersRound,
  UtensilsCrossed,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/lib/routes';

export const NAV_SECTION = { OPERATIONS: '운영', REWARDS: '리워드', STORE: '매장' } as const;

export type AdminNavItem = {
  path: string;
  label: string;
  subtitle: string;
  section: (typeof NAV_SECTION)[keyof typeof NAV_SECTION];
  icon: LucideIcon;
  end?: boolean;
};

/** The eight sidebar items, in the order set by the brief. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    path: ROUTES.ADMIN,
    label: '대시보드',
    subtitle: '오늘 매장 현황을 한눈에 확인하세요.',
    section: NAV_SECTION.OPERATIONS,
    icon: LayoutDashboard,
    end: true,
  },
  {
    path: ROUTES.ADMIN_MENU,
    label: '메뉴 관리',
    subtitle: '메뉴와 카테고리, 품절 상태를 관리해요.',
    section: NAV_SECTION.OPERATIONS,
    icon: UtensilsCrossed,
  },
  {
    path: ROUTES.ADMIN_ORDERS,
    label: '주문 내역',
    subtitle: '지난 주문을 검색하고 상세 내용을 확인해요.',
    section: NAV_SECTION.OPERATIONS,
    icon: Receipt,
  },
  {
    path: ROUTES.ADMIN_MEMBERS,
    label: '회원관리',
    subtitle: '고객 회원 정보를 조회해요. 보기 전용이며 개인정보는 마스킹돼요.',
    section: NAV_SECTION.OPERATIONS,
    icon: UserRound,
  },
  {
    path: ROUTES.ADMIN_REWARDS,
    label: '리워드 관리',
    subtitle: '올리브 스탬프 적립 정책과 교환 쿠폰을 설정해요.',
    section: NAV_SECTION.REWARDS,
    icon: Leaf,
  },
  {
    path: ROUTES.ADMIN_POINTS,
    label: '쿠폰 포인트 관리',
    subtitle: '쿠폰 코드를 발급하고 사용 현황을 조회해요.',
    section: NAV_SECTION.REWARDS,
    icon: Coins,
  },
  {
    path: ROUTES.ADMIN_NOTICES,
    label: '공지사항',
    subtitle: '고객 앱에 보여줄 공지를 작성하고 게시해요.',
    section: NAV_SECTION.STORE,
    icon: Megaphone,
  },
  {
    path: ROUTES.ADMIN_STAFF,
    label: '직원 관리',
    subtitle: '직원 계정과 기본 권한을 관리해요.',
    section: NAV_SECTION.STORE,
    icon: UsersRound,
  },
  {
    path: ROUTES.ADMIN_SETTINGS,
    label: '매장 설정',
    subtitle: '매장 정보와 영업 시간, 주문 접수를 설정해요.',
    section: NAV_SECTION.STORE,
    icon: Settings,
  },
];
