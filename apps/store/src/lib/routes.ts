export const ROUTES = {
  ORDERS: '/orders',
  ADMIN: '/admin',
  ADMIN_MENU: '/admin/menu',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_MEMBERS: '/admin/members',
  ADMIN_REWARDS: '/admin/rewards',
  ADMIN_POINTS: '/admin/points',
  ADMIN_NOTICES: '/admin/notices',
  ADMIN_STAFF: '/admin/staff',
  ADMIN_SETTINGS: '/admin/settings',
} as const;

export const memberDetailPath = (memberId: string): string => `/admin/members/${memberId}`;
export const orderDetailPath = (orderId: string): string => `/admin/orders?order=${orderId}`;
