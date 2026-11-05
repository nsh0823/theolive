import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Megaphone } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Card } from '@/components/ui/Card';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNoticesQuery } from '@/hooks/useNotices';

export default function NoticesScreen() {
  const router = useRouter();
  const state = useNoticesQuery();
  return (
    <Screen>
      <QueryBoundary
        state={state}
        isEmpty={isEmptyList}
        emptyMessage="등록된 공지사항이 없어요."
        emptyIcon={Megaphone}
      >
        {(notices) =>
          notices.map((notice) => (
            <Pressable
              key={notice.id}
              onPress={() =>
                router.push({ pathname: '/other/notices/[id]', params: { id: notice.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`${notice.title}, ${notice.publishedAt}`}
            >
              <Card className="gap-1">
                <Text className="font-semibold">{notice.title}</Text>
                <Text size="xs" className="text-muted-foreground">
                  {notice.publishedAt}
                </Text>
              </Card>
            </Pressable>
          ))
        }
      </QueryBoundary>
    </Screen>
  );
}
