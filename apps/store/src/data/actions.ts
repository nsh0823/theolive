import { applyStaffAction, STAFF_ACTION, type StaffAction } from '@/domain/orderTransitions';
import {
  type BusinessHours,
  type MenuCategory,
  type MenuItem,
  type Notice,
  type NoticeStatus,
  type NotificationSettings,
  type Order,
  type PointCode,
  type StaffMember,
  type StampExchangeRule,
  type StampPolicy,
  type StoreInfo,
  type StoreStatus,
  NOTICE_STATUS,
} from '@/domain/models';
import {
  categoriesStore,
  connectionStore,
  exchangeRulesStore,
  hoursStore,
  menuStore,
  noticesStore,
  notificationSettingsStore,
  ordersStore,
  pointCodesStore,
  staffStore,
  stampPolicyStore,
  storeInfoStore,
  storeStatusStore,
} from './stores';

// Fixture mutations: local state only. Every one of these becomes a server call (with RLS and
// server-side validation) when packages/api is wired; the client never decides the real outcome.

export type OrderActionResult =
  { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'INVALID_TRANSITION' };

export function applyOrderAction(
  orderId: string,
  action: StaffAction,
  rejectReason: string | null = null,
): OrderActionResult {
  const order = ordersStore.get().find((candidate) => candidate.id === orderId);
  if (!order) return { ok: false, reason: 'NOT_FOUND' };
  const result = applyStaffAction(order.status, action);
  if (!result.ok) return result;
  const reason = action === STAFF_ACTION.REJECT ? rejectReason : order.rejectReason;
  // Refund handling after rejection is an open policy question (PRD 15-8), so paymentStatus is left as is.
  ordersStore.set((orders) =>
    orders.map((o): Order =>
      o.id === orderId ? { ...o, status: result.status, rejectReason: reason } : o,
    ),
  );
  return { ok: true };
}

export const setStoreStatus = (patch: Partial<StoreStatus>) =>
  storeStatusStore.set((previous) => ({ ...previous, ...patch }));
export const setConnected = (isConnected: boolean) => connectionStore.set(() => ({ isConnected }));
export const setStoreInfo = (info: StoreInfo) => storeInfoStore.set(() => info);
export const setHours = (hours: BusinessHours[]) => hoursStore.set(() => hours);
export const setNotificationSettings = (settings: NotificationSettings) =>
  notificationSettingsStore.set(() => settings);

export function setItemSoldOut(itemId: string, isSoldOut: boolean): void {
  menuStore.set((items) =>
    items.map((item) => (item.id === itemId ? { ...item, isSoldOut } : item)),
  );
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function saveMenuItem(item: MenuItem): void {
  menuStore.set((items) =>
    items.some((candidate) => candidate.id === item.id)
      ? items.map((candidate) => (candidate.id === item.id ? item : candidate))
      : [...items, item],
  );
}
export const deleteMenuItem = (id: string) =>
  menuStore.set((items) => items.filter((item) => item.id !== id));
export const saveCategories = (categories: MenuCategory[]) => categoriesStore.set(() => categories);

export function saveStaff(member: StaffMember): void {
  staffStore.set((list) =>
    list.some((candidate) => candidate.id === member.id)
      ? list.map((candidate) => (candidate.id === member.id ? member : candidate))
      : [...list, member],
  );
}

export function saveNotice(notice: Notice): void {
  noticesStore.set((list) =>
    list.some((candidate) => candidate.id === notice.id)
      ? list.map((candidate) => (candidate.id === notice.id ? notice : candidate))
      : [notice, ...list],
  );
}
export const deleteNotice = (id: string) =>
  noticesStore.set((list) => list.filter((n) => n.id !== id));
export function setNoticeStatus(id: string, status: NoticeStatus, nowIso: string): void {
  noticesStore.set((list) =>
    list.map((n) =>
      n.id === id
        ? { ...n, status, publishedAt: status === NOTICE_STATUS.PUBLISHED ? nowIso : null }
        : n,
    ),
  );
}

export const setStampPolicy = (policy: StampPolicy) => stampPolicyStore.set(() => policy);
export function saveExchangeRule(rule: StampExchangeRule): void {
  exchangeRulesStore.set((list) =>
    list.some((candidate) => candidate.id === rule.id)
      ? list.map((candidate) => (candidate.id === rule.id ? rule : candidate))
      : [...list, rule].sort((a, b) => a.requiredStamps - b.requiredStamps),
  );
}
export const deleteExchangeRule = (id: string) =>
  exchangeRulesStore.set((list) => list.filter((rule) => rule.id !== id));

export const addPointCodes = (codes: PointCode[]) =>
  pointCodesStore.set((list) => [...codes, ...list]);
