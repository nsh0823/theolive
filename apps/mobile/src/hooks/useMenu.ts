import { useMenuCategories, useMenuItem, useMenuItems } from '@theolive/api';

import { toQueryState, type QueryState } from '@/lib/queryState';
import type { MenuCategory, MenuItem } from '@/models';
import { supabase } from '@/services/supabase';

/** Categories the customer can see (inactive ones are hidden by row-level security). */
export function useCategoriesQuery(): QueryState<MenuCategory[]> {
  return toQueryState(useMenuCategories(supabase));
}

/** Orderable menu. Sold-out items stay in the list so the screen can label them. */
export function useMenuQuery(): QueryState<MenuItem[]> {
  return toQueryState(useMenuItems(supabase));
}

export function useMenuItemQuery(itemId: string): QueryState<MenuItem | null> {
  return toQueryState(useMenuItem(supabase, itemId));
}
