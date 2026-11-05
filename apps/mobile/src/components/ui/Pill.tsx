import { Text } from '@theolive/ui/components/text';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppIcon } from './AppIcon';

type Props = { label: string; icon?: LucideIcon; tone?: 'neutral' | 'primary' | 'danger' };

const TONE_CLASS = {
  neutral: 'bg-secondary',
  primary: 'bg-primary',
  danger: 'border border-destructive bg-card',
} as const;

const TEXT_CLASS = {
  neutral: 'text-secondary-foreground',
  primary: 'text-primary-foreground',
  danger: 'text-destructive',
} as const;

/** Small status label: always text (plus optional icon), never color alone (PRD 10.4). */
export function Pill({ label, icon, tone = 'neutral' }: Props) {
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${TONE_CLASS[tone]}`}
    >
      {icon ? (
        <AppIcon
          icon={icon}
          size={12}
          tone={
            tone === 'primary'
              ? 'primaryForeground'
              : tone === 'danger'
                ? 'destructive'
                : 'secondaryForeground'
          }
        />
      ) : null}
      <Text size="xs" className={`font-semibold ${TEXT_CLASS[tone]}`}>
        {label}
      </Text>
    </View>
  );
}
