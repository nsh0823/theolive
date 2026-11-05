import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Coffee } from 'lucide-react-native';
import { View } from 'react-native';

import { RecentOrderList } from '@/components/home/RecentOrderList';
import { RewardSummary } from '@/components/home/RewardSummary';
import { ShortcutPills } from '@/components/home/ShortcutPills';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useOrdersQuery } from '@/hooks/useOrders';
import { useProfileQuery } from '@/hooks/useProfileQuery';
import { useRewardSummaryQuery } from '@/hooks/useRewardSummary';
import { recentOrderLines } from '@/lib/reorder';

const RECENT_LINE_LIMIT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfileQuery();
  const orders = useOrdersQuery();
  const rewards = useRewardSummaryQuery();

  return (
    <Screen>
      <View className="gap-2 pt-2">
        <Heading size="3xl" accessibilityRole="header">
          {profile.status === 'success'
            ? `안녕하세요, ${profile.data.displayName}님!`
            : '안녕하세요!'}
        </Heading>
        <Text className="text-muted-foreground">오늘도 더올리브와 함께하세요.</Text>
      </View>

      {rewards.status === 'success' ? (
        <ShortcutPills
          stamps={rewards.data.stamps}
          points={rewards.data.points}
          couponCount={rewards.data.couponCount}
        />
      ) : null}

      <View className="gap-4">
        <SectionHeader title="빠른 주문" actionLabel="메뉴 보기" actionHref="/order" />
        <QueryBoundary
          state={orders}
          isEmpty={(list) => recentOrderLines(list, RECENT_LINE_LIMIT).length === 0}
          emptyMessage="아직 주문한 메뉴가 없어요."
          emptyIcon={Coffee}
          emptyActionLabel="메뉴 둘러보기"
          onEmptyAction={() => router.push('/order')}
        >
          {(list) => <RecentOrderList lines={recentOrderLines(list, RECENT_LINE_LIMIT)} />}
        </QueryBoundary>
      </View>

      <QueryBoundary state={rewards} emptyMessage="">
        {({ stamps, points }) => <RewardSummary stamps={stamps} points={points} />}
      </QueryBoundary>
    </Screen>
  );
}
