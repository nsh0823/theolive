import {
  membersStore,
  stampLedgerStore,
  pointLedgerStore,
  categoriesStore,
  exchangeRulesStore,
  hoursStore,
  issuedCouponsStore,
  menuStore,
  noticesStore,
  notificationSettingsStore,
  ordersStore,
  pointCodesStore,
  staffStore,
  stampOverviewStore,
  stampPolicyStore,
  storeInfoStore,
  storeStatusStore,
  connectionStore,
} from './stores';
import { useStoreValue } from './createStore';
import { useFixtureQuery } from './useFixtureQuery';

// Query-shaped hooks. Each returns { status, data, refetch }; swap for packages/api hooks later.
export const useOrdersQuery = () => useFixtureQuery(ordersStore, []);
export const useMembersQuery = () => useFixtureQuery(membersStore, []);
export const useStampLedgersQuery = () => useFixtureQuery(stampLedgerStore, {});
export const usePointLedgersQuery = () => useFixtureQuery(pointLedgerStore, {});
export const useMenuQuery = () => useFixtureQuery(menuStore, []);
export const useCategoriesQuery = () => useFixtureQuery(categoriesStore, []);
export const useStaffQuery = () => useFixtureQuery(staffStore, []);
export const useNoticesQuery = () => useFixtureQuery(noticesStore, []);
export const useExchangeRulesQuery = () => useFixtureQuery(exchangeRulesStore, []);
export const useIssuedCouponsQuery = () => useFixtureQuery(issuedCouponsStore, []);
export const usePointCodesQuery = () => useFixtureQuery(pointCodesStore, []);
export const useStampPolicyQuery = () => useFixtureQuery(stampPolicyStore, stampPolicyStore.get());
export const useStampOverviewQuery = () =>
  useFixtureQuery(stampOverviewStore, {
    earnedThisMonth: 0,
    exchangedCoupons: 0,
    outstandingStamps: 0,
  });
export const useStoreInfoQuery = () => useFixtureQuery(storeInfoStore, storeInfoStore.get());
export const useHoursQuery = () => useFixtureQuery(hoursStore, hoursStore.get());
export const useNotificationSettingsQuery = () =>
  useFixtureQuery(notificationSettingsStore, notificationSettingsStore.get());

// Operating status is tiny local UI state, so it has no loading state of its own.
export const useStoreStatus = () => useStoreValue(storeStatusStore);
export const useConnection = () => useStoreValue(connectionStore);
