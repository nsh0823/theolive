import { useQuery } from '@tanstack/react-query';
import type { MenuCategoryRow, MenuItemRow, Temperature } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { queryKeys } from './query-keys';

export const MENU_IMAGE_BUCKET = 'menu-images';

export type MenuCategoryView = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

/** Menu item as both apps render it. Prices are display values; the server prices every order. */
export type MenuItemView = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  /** Empty when the item has no temperature choice (OQ-16). */
  temperatures: Temperature[];
  isSoldOut: boolean;
  /** `false` hides the item from customers (판매 중지). */
  isActive: boolean;
  /** Object path in the `menu-images` bucket. */
  imagePath: string | null;
  imageUrl: string | null;
};

export function toMenuCategoryView(row: MenuCategoryRow): MenuCategoryView {
  return { id: row.id, name: row.name, isActive: row.is_active, sortOrder: row.sort_order };
}

export function toMenuItemView(
  row: MenuItemRow,
  getImageUrl: (path: string) => string,
): MenuItemView {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    temperatures: row.temperatures,
    isSoldOut: row.is_sold_out,
    isActive: row.is_active,
    imagePath: row.image_path,
    imageUrl: row.image_path ? getImageUrl(row.image_path) : null,
  };
}

function imageUrlResolver(client: Pick<TypedSupabaseClient, 'storage'>) {
  return (path: string) => client.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Row-level security decides what the caller sees: customers get visible items, staff and admins more. */
export async function fetchMenuCategories(
  client: Pick<TypedSupabaseClient, 'from'>,
): Promise<MenuCategoryView[]> {
  const { data, error } = await client
    .from('menu_categories')
    .select('*')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data.map(toMenuCategoryView);
}

/** Archived items are never listed, even for admins (they are kept only for order history). */
export async function fetchMenuItems(
  client: Pick<TypedSupabaseClient, 'from' | 'storage'>,
): Promise<MenuItemView[]> {
  const { data, error } = await client
    .from('menu_items')
    .select('*')
    .is('archived_at', null)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data.map((row) => toMenuItemView(row, imageUrlResolver(client)));
}

export async function fetchMenuItem(
  client: Pick<TypedSupabaseClient, 'from' | 'storage'>,
  id: string,
): Promise<MenuItemView | null> {
  const { data, error } = await client
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? toMenuItemView(data, imageUrlResolver(client)) : null;
}

/** Short stale time: sold-out changes should show up soon even when a realtime event is missed. */
const MENU_STALE_TIME_MS = 30_000;

export function useMenuCategories(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.menu.categories(),
    queryFn: () => fetchMenuCategories(client),
    staleTime: MENU_STALE_TIME_MS,
  });
}

export function useMenuItems(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.menu.items(),
    queryFn: () => fetchMenuItems(client),
    staleTime: MENU_STALE_TIME_MS,
  });
}

export function useMenuItem(client: TypedSupabaseClient, id: string) {
  return useQuery({
    queryKey: queryKeys.menu.item(id),
    queryFn: () => fetchMenuItem(client, id),
    staleTime: MENU_STALE_TIME_MS,
    enabled: id !== '',
  });
}
