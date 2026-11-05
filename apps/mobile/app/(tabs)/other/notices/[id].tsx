import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';

import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNoticeQuery } from '@/hooks/useNotices';
import { useRouteParam } from '@/hooks/useRouteParam';

export default function NoticeDetailScreen() {
  const id = useRouteParam('id');
  const state = useNoticeQuery(id ?? undefined);
  return (
    <QueryBoundary
      state={state}
      isEmpty={(notice) => notice === null}
      emptyMessage="공지사항을 찾을 수 없어요."
    >
      {(notice) =>
        notice ? (
          <Screen>
            <Heading size="lg">{notice.title}</Heading>
            <Text size="xs" className="text-muted-foreground">
              {notice.publishedAt}
            </Text>
            <Text>{notice.body}</Text>
          </Screen>
        ) : null
      }
    </QueryBoundary>
  );
}
