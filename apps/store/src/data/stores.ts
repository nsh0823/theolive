import { createStore } from './createStore';
import { createCategories, createMenu } from './fixtures/menu';
import { createOrders } from './fixtures/orders';
import { createMembers, createPointLedgers, createStampLedgers } from './fixtures/members';
import {
  createExchangeRules,
  createHours,
  createIssuedCoupons,
  createNotices,
  createNotificationSettings,
  createPointCodes,
  createStaff,
  createStampOverview,
  createStampPolicy,
  createStoreInfo,
  createStoreStatus,
} from './fixtures/admin';

// Store Web and Store Admin read the same stores, so sold-out and operating status stay in sync (SW-07, SA-05).
export const ordersStore = createStore(() => createOrders());
export const menuStore = createStore(createMenu);
export const categoriesStore = createStore(createCategories);
export const storeStatusStore = createStore(createStoreStatus);
export const storeInfoStore = createStore(createStoreInfo);
export const hoursStore = createStore(createHours);
export const notificationSettingsStore = createStore(createNotificationSettings);
export const staffStore = createStore(createStaff);
export const noticesStore = createStore(createNotices);

export const membersStore = createStore(() => createMembers());
// Ledgers are separate stores per asset and are built from the orders store (declared above, reset first).
export const stampLedgerStore = createStore(() =>
  createStampLedgers(membersStore.get(), ordersStore.get()),
);
export const pointLedgerStore = createStore(() =>
  createPointLedgers(membersStore.get(), ordersStore.get()),
);

// Olive Stamps and Coupon Points use separate stores on purpose: never merge balances or ledgers.
export const stampPolicyStore = createStore(createStampPolicy);
export const exchangeRulesStore = createStore(createExchangeRules);
export const stampOverviewStore = createStore(createStampOverview);
export const issuedCouponsStore = createStore(createIssuedCoupons);
export const pointCodesStore = createStore(createPointCodes);

/** Fixture-only switch to preview the realtime-disconnected banner (PRD 5.7). */
export const connectionStore = createStore(() => ({ isConnected: true }));

const ALL_STORES = [
  ordersStore,
  membersStore,
  stampLedgerStore,
  pointLedgerStore,
  menuStore,
  categoriesStore,
  storeStatusStore,
  storeInfoStore,
  hoursStore,
  notificationSettingsStore,
  staffStore,
  noticesStore,
  stampPolicyStore,
  exchangeRulesStore,
  stampOverviewStore,
  issuedCouponsStore,
  pointCodesStore,
  connectionStore,
];

export function resetAllFixtures(): void {
  ALL_STORES.forEach((store) => store.reset());
}
