import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Coffee } from 'lucide-react-native';
import { View } from 'react-native';

import { RecentMenuList } from '@/components/home/RecentMenuList';
import { RewardSummary } from '@/components/home/RewardSummary';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { combineStates } from '@/lib/queryState';
import {
  usePointsQuery,
  useProfileQuery,
  useRecentMenuQuery,
  useStampsQuery,
} from '@/fixtures/queries';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfileQuery();
  const recent = useRecentMenuQuery();
  const rewards = combineStates(useStampsQuery(), usePointsQuery());

  return (
    <Screen>
      <View className="gap-1">
        <Heading size="xl">
          {profile.status === 'success'
            ? `${profile.data.displayName}님, 안녕하세요`
            : '안녕하세요'}
        </Heading>
        <Text className="text-muted-foreground">오늘도 더올리브와 함께해요.</Text>
      </View>

      <View className="gap-3">
        <SectionHeader title="최근 주문 메뉴" actionLabel="메뉴 보기" actionHref="/order" />
        <QueryBoundary
          state={recent}
          isEmpty={isEmptyList}
          emptyMessage="아직 주문한 메뉴가 없어요."
          emptyIcon={Coffee}
          emptyActionLabel="메뉴 둘러보기"
          onEmptyAction={() => router.push('/order')}
        >
          {(items) => <RecentMenuList items={items} />}
        </QueryBoundary>
      </View>

      <QueryBoundary state={rewards} emptyMessage="">
        {([stamps, points]) => <RewardSummary stamps={stamps} points={points} />}
      </QueryBoundary>
    </Screen>
  );
}
