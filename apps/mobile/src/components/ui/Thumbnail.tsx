import { Coffee } from 'lucide-react-native';
import { Image, View } from 'react-native';

import { AppIcon } from './AppIcon';

// Round tiles for list rows (menu, cart, quick order); `lg` is the full-bleed detail hero.
const SIZE_CLASS = {
  sm: 'h-14 w-14 rounded-full',
  md: 'h-20 w-20 rounded-full',
  xl: 'h-24 w-24 rounded-full',
  lg: 'h-72 w-full',
} as const;
const ICON_SIZE = { sm: 24, md: 32, xl: 40, lg: 96 } as const;

type Props = { size?: keyof typeof SIZE_CLASS; imageUrl?: string | null };

/** Product photo from Storage (SA-04), or a cream tile with a cup glyph when the item has no photo yet. */
export function Thumbnail({ size = 'md', imageUrl = null }: Props) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        className={`${SIZE_CLASS[size]} bg-cream`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  return (
    <View
      className={`${SIZE_CLASS[size]} items-center justify-center bg-cream`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppIcon icon={Coffee} tone="primary" size={ICON_SIZE[size]} />
    </View>
  );
}
