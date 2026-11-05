import type { Database } from './supabase';

export type { Database, Json } from './supabase';
export * from './constants';
export * from './errors';

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type Profile = Tables<'profiles'>;
export type StaffMemberRow = Tables<'staff_members'>;
export type AdminAuditLogRow = Tables<'admin_audit_log'>;
export type StoreSettingsRow = Tables<'store_settings'>;
export type BusinessHoursRow = Tables<'business_hours'>;
export type MenuCategoryRow = Tables<'menu_categories'>;
export type MenuItemRow = Tables<'menu_items'>;
export type OrderRow = Tables<'orders'>;
export type StampPolicyRow = Tables<'stamp_policies'>;
export type StampTransactionRow = Tables<'stamp_transactions'>;
export type CouponRow = Tables<'coupons'>;
// Coupon Points have their own row types; none of these are shared with the stamp or coupon ones above.
export type CouponPointPolicyRow = Tables<'coupon_point_policy'>;
export type CouponPointTransactionRow = Tables<'coupon_point_transactions'>;
export type UserCouponRow = Tables<'user_coupons'>;
export type UserCouponViewRow = PublicSchema['Views']['user_coupon_view']['Row'];
export type NotificationRow = Tables<'notifications'>;
export type NotificationPreferencesRow = Tables<'notification_preferences'>;
export type AnnouncementRow = Tables<'announcements'>;
export type OrderItemRow = Tables<'order_items'>;
export type OrderStatusHistoryRow = Tables<'order_status_history'>;
