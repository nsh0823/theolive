import { Cake, Coffee, CupSoda, Leaf, Milk, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppIcon } from './AppIcon';

// Round tiles for list rows (menu, cart, quick order); `lg` is the full-bleed detail hero.
const SIZE_CLASS = {
  sm: 'h-14 w-14 rounded-full',
  md: 'h-20 w-20 rounded-full',
  xl: 'h-24 w-24 rounded-full',
  lg: 'h-72 w-full',
} as const;
const ICON_SIZE = { sm: 24, md: 32, xl: 40, lg: 96 } as const;

const CATEGORY_ICON: Record<string, LucideIcon> = {
  coffee: Coffee,
  latte: Milk,
  'non-coffee': CupSoda,
  tea: Leaf,
  dessert: Cake,
};

type Props = { size?: keyof typeof SIZE_CLASS; categoryId?: string };

/**
 * Placeholder until product photography ships from Storage (SA-04): a cream tile with a
 * category glyph. Swap for the real image with the same footprint.
 */
export function Thumbnail({ size = 'md', categoryId }: Props) {
  const icon = (categoryId ? CATEGORY_ICON[categoryId] : undefined) ?? Coffee;
  return (
    <View
      className={`${SIZE_CLASS[size]} items-center justify-center bg-cream`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppIcon icon={icon} tone="primary" size={ICON_SIZE[size]} />
    </View>
  );
}
