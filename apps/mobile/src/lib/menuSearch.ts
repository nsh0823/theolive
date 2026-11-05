import type { MenuItem } from '@/models';

/** Case-insensitive match on name or description; blank queries match nothing. */
export function searchMenu(menu: MenuItem[], query: string): MenuItem[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  return menu.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle),
  );
}
