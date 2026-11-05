export const queryKeys = {
  profiles: {
    all: ['profiles'] as const,
    detail: (id: string) => ['profiles', id] as const,
  },
  menu: {
    all: ['menu'] as const,
    categories: () => ['menu', 'categories'] as const,
    items: () => ['menu', 'items'] as const,
    item: (id: string) => ['menu', 'items', id] as const,
  },
  store: {
    all: ['store'] as const,
    settings: () => ['store', 'settings'] as const,
    hours: () => ['store', 'hours'] as const,
  },
  orders: {
    all: ['orders'] as const,
    mine: () => ['orders', 'mine'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    board: () => ['orders', 'board'] as const,
    admin: (filters: unknown) => ['orders', 'admin', filters] as const,
  },
  payments: {
    all: ['payments'] as const,
    status: (id: string) => ['payments', 'status', id] as const,
  },
  rewards: {
    all: ['rewards'] as const,
    stampBalance: (userId: string) => ['rewards', 'stamp-balance', userId] as const,
    stampLedger: (userId: string) => ['rewards', 'stamp-ledger', userId] as const,
    exchangeOptions: () => ['rewards', 'exchange-options'] as const,
    coupons: (userId: string) => ['rewards', 'coupons', userId] as const,
    quote: (params: unknown) => ['rewards', 'quote', params] as const,
    pointSummary: (userId: string) => ['rewards', 'point-summary', userId] as const,
    pointLedger: (userId: string) => ['rewards', 'point-ledger', userId] as const,
    summary: (userId: string) => ['rewards', 'summary', userId] as const,
  },
  rewardsAdmin: {
    all: ['rewards-admin'] as const,
    policy: () => ['rewards-admin', 'policy'] as const,
    rules: () => ['rewards-admin', 'rules'] as const,
    overview: () => ['rewards-admin', 'overview'] as const,
    issued: () => ['rewards-admin', 'issued'] as const,
  },
  pointsAdmin: {
    all: ['points-admin'] as const,
    policy: () => ['points-admin', 'policy'] as const,
    codes: (filters: unknown) => ['points-admin', 'codes', filters] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) => ['notifications', 'list', userId] as const,
    unread: (userId: string) => ['notifications', 'unread', userId] as const,
    preferences: (userId: string) => ['notifications', 'preferences', userId] as const,
  },
  announcements: {
    all: ['announcements'] as const,
    list: () => ['announcements', 'list'] as const,
    detail: (id: string) => ['announcements', 'detail', id] as const,
    admin: () => ['announcements', 'admin'] as const,
  },
  account: { all: ['account'] as const },
  reporting: {
    all: ['reporting'] as const,
    sales: (from: string, to: string) => ['reporting', 'sales', from, to] as const,
    popular: (from: string, to: string, limit: number) =>
      ['reporting', 'popular', from, to, limit] as const,
  },
  members: {
    all: ['members'] as const,
    list: (filters: unknown) => ['members', 'list', filters] as const,
    detail: (id: string) => ['members', 'detail', id] as const,
  },
  staff: {
    all: ['staff'] as const,
    myRole: (userId: string) => ['staff', 'me', userId] as const,
    list: () => ['staff', 'list'] as const,
  },
};
