import type { LucideIcon } from 'lucide-react-native';

import { useToneColor, type Tone } from '@/lib/useToneColor';

type Props = { icon: LucideIcon; tone?: Tone; size?: number };

const DEFAULT_ICON_SIZE = 20;

/** Decorative by default; pair with a labelled parent control. */
export function AppIcon({ icon: Icon, tone = 'foreground', size = DEFAULT_ICON_SIZE }: Props) {
  const color = useToneColor(tone);
  return (
    <Icon color={color} size={size} accessibilityElementsHidden importantForAccessibility="no" />
  );
}
