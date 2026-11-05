import { Coffee } from 'lucide-react-native';
import { View } from 'react-native';

import { AppIcon } from './AppIcon';

const SIZE_CLASS = { md: 'h-20 w-20', sm: 'h-14 w-14', lg: 'h-48 w-full' } as const;
const ICON_SIZE = { md: 28, sm: 22, lg: 48 } as const;

type Props = { size?: keyof typeof SIZE_CLASS };

/** Placeholder until product images ship from Storage (SA-04). */
export function Thumbnail({ size = 'md' }: Props) {
  return (
    <View
      className={`${SIZE_CLASS[size]} items-center justify-center rounded-md bg-secondary`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppIcon icon={Coffee} tone="primary" size={ICON_SIZE[size]} />
    </View>
  );
}
