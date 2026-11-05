import { Text } from '@theolive/ui/components/text';
import { useRouter, type Href } from 'expo-router';
import { Coins, Leaf, Ticket, type LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { formatWon } from '@/lib/format';
import type { PointSummary, StampSummary } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { ChipRow } from '../ui/ChipRow';

type PillProps = { icon: LucideIcon; label: string; value: string; href: Href };

function ShortcutPill({ icon, label, value, href }: PillProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      className="min-h-12 flex-row items-center gap-2 rounded-full border border-border bg-card px-5 active:bg-secondary"
    >
      <AppIcon icon={icon} tone="primary" size={18} />
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="font-bold text-primary">{value}</Text>
    </Pressable>
  );
}

type Props = { stamps: StampSummary; couponCount: number; points: PointSummary };

/**
 * Quick-glance pills under the greeting. Stamps, coupons, and points stay three distinct
 * pills with their own glyph and unit (개 / 장 / 원); balances are never combined.
 */
export function ShortcutPills({ stamps, couponCount, points }: Props) {
  return (
    <ChipRow>
      <ShortcutPill icon={Leaf} label="스탬프" value={`${stamps.count}개`} href="/reward/stamps" />
      <ShortcutPill icon={Ticket} label="쿠폰" value={`${couponCount}장`} href="/reward/coupons" />
      <ShortcutPill
        icon={Coins}
        label="포인트"
        value={formatWon(points.balance)}
        href="/reward/points"
      />
    </ChipRow>
  );
}
