process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// react-aria (via gluestack) patches `window.screen` when NODE_ENV=test; the RN test env has none.
if (typeof window !== 'undefined' && !window.screen) {
  Object.defineProperty(window, 'screen', { value: {}, configurable: true });
}

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Menu data comes from Supabase in the app. Screen tests get a fixed server response; individual tests
// override a hook with `jest.mocked(useMenuQuery).mockReturnValue(...)` to exercise loading / offline / error / empty.
jest.mock('@/hooks/useMenu', () => {
  const testMenu = jest.requireActual('./test-utils/testMenu');
  return {
    useCategoriesQuery: jest.fn(testMenu.categoriesQueryDefault),
    useMenuQuery: jest.fn(testMenu.menuQueryDefault),
    useMenuItemQuery: jest.fn(testMenu.menuItemQueryDefault),
  };
});

// Stamps and coupons come from Supabase too. Individual tests override a hook to exercise the other states or
// the exchange / checkout flows.
jest.mock('@/hooks/useRewards', () => {
  const rewards = jest.requireActual('./test-utils/testRewards');
  return {
    useStampsQuery: jest.fn(rewards.stampsDefault),
    useStampExchangeQuery: jest.fn(rewards.exchangeDefault),
    useCouponsQuery: jest.fn(rewards.couponsDefault),
    useStampLedgerQuery: jest.fn(rewards.ledgerDefault),
    useRedeemStampsMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
    useCheckoutQuoteResult: jest.fn(() => ({ data: undefined, error: null, isFetching: false })),
  };
});

// Coupon Points come from Supabase too (own hooks; nothing shared with the stamp hooks above).
jest.mock('@/hooks/usePoints', () => {
  const points = jest.requireActual('./test-utils/testPoints');
  return {
    usePointsQuery: jest.fn(points.pointsDefault),
    usePointLedgerQuery: jest.fn(points.pointLedgerDefault),
    useRegisterPointCodeMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
  };
});

// Store switches come from Supabase too: tests start with an open, accepting store and override per test.
jest.mock('@/hooks/useStoreStatus', () => ({
  useStoreStatusQuery: jest.fn(() => ({
    status: 'success',
    data: { isOpen: true, isAcceptingOrders: true },
  })),
  useOrderAvailability: jest.fn(() => ({ canOrder: true, message: null })),
}));

// Per the netinfo docs: the library's own jest mock, so no native module is needed.
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Profile, reward summary, notifications and notices come from Supabase too. Tests override a hook to exercise
// other states; the defaults give a signed-in member with a few of each.
jest.mock('@/hooks/useProfileQuery', () => ({
  useProfileQuery: jest.fn(() => ({
    status: 'success',
    data: { displayName: '피터', email: 'peter@example.com', loginProvider: '카카오' },
  })),
  useUpdateNicknameMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock('@/hooks/useRewardSummary', () => ({
  useRewardSummaryQuery: jest.fn(() => ({
    status: 'success',
    data: {
      stamps: { count: 7, goal: 10 },
      points: { balance: 12000, held: 0, available: 12000, nextExpiresAt: null },
      couponCount: 1,
    },
  })),
}));
