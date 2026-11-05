import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toAppErrorCode } from '@theolive/types';
import {
  businessHoursSchema,
  categoryNameSchema,
  menuItemInputSchema,
  notificationSettingsSchema,
  storeInfoSchema,
  type MenuItemInput,
} from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { MENU_IMAGE_BUCKET } from './menu';
import { queryKeys } from './query-keys';
import type { BusinessHoursView, NotificationSettingsView, StoreInfoView } from './store';

type Rpc = Pick<TypedSupabaseClient, 'rpc'>;
type Db = Pick<TypedSupabaseClient, 'from'>;

function failWith(error: unknown): never {
  throw new AppError(toAppErrorCode(error));
}

/** Validation failures use the same code as a server-side rejection so callers handle one case. */
function invalidInput(): never {
  throw new AppError('INVALID_INPUT');
}

// ---- Store status (staff with MANAGE_OPERATIONS, admins) ----

export async function setStoreStatus(
  client: Rpc,
  patch: { isOpen?: boolean; isAcceptingOrders?: boolean },
): Promise<void> {
  const { error } = await client.rpc('set_store_status', {
    p_is_open: patch.isOpen,
    p_is_accepting_orders: patch.isAcceptingOrders,
  });
  if (error) failWith(error);
}

export function useSetStoreStatus(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { isOpen?: boolean; isAcceptingOrders?: boolean }) =>
      setStoreStatus(client, patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.store.all }),
  });
}

export async function setMenuItemSoldOut(
  client: Rpc,
  menuItemId: string,
  isSoldOut: boolean,
): Promise<void> {
  const { error } = await client.rpc('set_menu_item_sold_out', {
    p_menu_item_id: menuItemId,
    p_is_sold_out: isSoldOut,
  });
  if (error) failWith(error);
}

export function useSetSoldOut(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { menuItemId: string; isSoldOut: boolean }) =>
      setMenuItemSoldOut(client, input.menuItemId, input.isSoldOut),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu.all }),
  });
}

// ---- Admin: menu items ----

export type SaveMenuItemInput = { id: string | null; fields: MenuItemInput };

/** Creates the item when `id` is null, otherwise updates it. Returns the item id. */
export async function saveMenuItem(client: Db, input: SaveMenuItemInput): Promise<string> {
  const parsed = menuItemInputSchema.safeParse(input.fields);
  if (!parsed.success) invalidInput();
  const fields = parsed.data;
  const row = {
    category_id: fields.categoryId,
    name: fields.name,
    description: fields.description,
    price: fields.price,
    temperatures: fields.temperatures,
    is_active: fields.isActive,
    image_path: fields.imagePath,
  };
  const query = input.id
    ? client.from('menu_items').update(row).eq('id', input.id)
    : client.from('menu_items').insert(row);
  const { data, error } = await query.select('id').single();
  if (error) failWith(error);
  return data.id;
}

export function useSaveMenuItem(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMenuItemInput) => saveMenuItem(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu.all }),
  });
}

/** "삭제" archives the item so past orders keep their reference (OQ-41). */
export async function archiveMenuItem(client: Db, id: string): Promise<void> {
  const { error } = await client
    .from('menu_items')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) failWith(error);
}

export function useArchiveMenuItem(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveMenuItem(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu.all }),
  });
}

// ---- Admin: categories ----

export type SaveCategoryInput = { id: string | null; name: string; isActive: boolean };

export async function reorderCategories(client: Rpc, ids: string[]): Promise<void> {
  const { error } = await client.rpc('admin_reorder_categories', { p_ids: ids });
  if (error) failWith(error);
}

/**
 * Applies the category editor's draft: renames/toggles changed rows, creates new ones (id null), then saves the order.
 * Category names are unique, so a failed step leaves earlier steps applied; the editor refetches and shows the result.
 */
export async function saveCategoryList(
  client: Db & Rpc,
  draft: SaveCategoryInput[],
  current: { id: string; name: string; isActive: boolean }[],
): Promise<void> {
  const ids: string[] = [];
  for (const entry of draft) {
    const before = current.find((candidate) => candidate.id === entry.id);
    const changed = !before || before.name !== entry.name || before.isActive !== entry.isActive;
    if (changed) {
      const savedId = await saveCategoryRow(client, entry);
      ids.push(savedId);
    } else if (entry.id) {
      ids.push(entry.id);
    }
  }
  await reorderCategories(client, ids);
}

async function saveCategoryRow(client: Db, input: SaveCategoryInput): Promise<string> {
  const name = categoryNameSchema.safeParse(input.name);
  if (!name.success) invalidInput();
  const row = { name: name.data, is_active: input.isActive };
  const query = input.id
    ? client.from('menu_categories').update(row).eq('id', input.id)
    : client.from('menu_categories').insert(row);
  const { data, error } = await query.select('id').single();
  if (error) failWith(error);
  return data.id;
}

export function useSaveCategories(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      draft: SaveCategoryInput[];
      current: { id: string; name: string; isActive: boolean }[];
    }) => saveCategoryList(client, input.draft, input.current),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu.all }),
  });
}

// ---- Admin: menu images ----

export const MENU_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const MENU_IMAGE_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Uploads under a fresh name so a replaced image is never served from a stale cache. Returns the object path. */
export async function uploadMenuImage(
  client: Pick<TypedSupabaseClient, 'storage'>,
  file: { type: string; size: number } & Blob,
): Promise<string> {
  const extension = MENU_IMAGE_TYPES[file.type];
  if (!extension || file.size > MENU_IMAGE_MAX_BYTES) invalidInput();
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) failWith(error);
  return path;
}

/** Best effort cleanup of an image that is no longer referenced. A failure is logged, never thrown. */
export async function removeMenuImage(
  client: Pick<TypedSupabaseClient, 'storage'>,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(MENU_IMAGE_BUCKET).remove([path]);
  if (error) console.error('Failed to remove an unused menu image', path, error);
}

export function useUploadMenuImage(client: TypedSupabaseClient) {
  return useMutation({ mutationFn: (file: File) => uploadMenuImage(client, file) });
}

// ---- Admin: store settings and hours ----

export async function saveStoreInfo(client: Db, info: StoreInfoView): Promise<void> {
  const parsed = storeInfoSchema.safeParse(info);
  if (!parsed.success) invalidInput();
  const { error } = await client.from('store_settings').update(parsed.data).eq('id', 1);
  if (error) failWith(error);
}

export async function saveNotificationSettings(
  client: Db,
  settings: NotificationSettingsView,
): Promise<void> {
  const parsed = notificationSettingsSchema.safeParse(settings);
  if (!parsed.success) invalidInput();
  const { error } = await client
    .from('store_settings')
    .update({
      new_order_sound: parsed.data.newOrderSound,
      new_order_banner: parsed.data.newOrderBanner,
      sold_out_reminder: parsed.data.soldOutReminder,
      daily_summary: parsed.data.dailySummary,
    })
    .eq('id', 1);
  if (error) failWith(error);
}

/** One upsert statement, so a week is saved completely or not at all. */
export async function saveBusinessHours(client: Db, hours: BusinessHoursView[]): Promise<void> {
  const parsed = businessHoursSchema.safeParse(hours);
  if (!parsed.success) invalidInput();
  const { error } = await client.from('business_hours').upsert(
    parsed.data.map((day) => ({
      weekday: day.weekday,
      is_closed: day.isClosed,
      opens_at: day.opensAt,
      closes_at: day.closesAt,
    })),
  );
  if (error) failWith(error);
}

export function useSaveStoreInfo(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (info: StoreInfoView) => saveStoreInfo(client, info),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.store.all }),
  });
}

export function useSaveNotificationSettings(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotificationSettingsView) => saveNotificationSettings(client, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.store.all }),
  });
}

export function useSaveBusinessHours(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hours: BusinessHoursView[]) => saveBusinessHours(client, hours),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.store.hours() }),
  });
}
