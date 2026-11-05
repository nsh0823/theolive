import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';

import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNoticesQuery } from '@/fixtures/queries';
import { useRouteParam } from '@/hooks/useRouteParam';
import { combineStates, successState } from '@/lib/queryState';

export default function NoticeDetailScreen() {
  const id = useRouteParam('id');
  const state = combineStates(useNoticesQuery(), successState(id));
  return (
    <QueryBoundary
      state={state}
      isEmpty={([notices, noticeId]) => !notices.some((notice) => notice.id === noticeId)}
      emptyMessage="공지사항을 찾을 수 없어요."
    >
      {([notices, noticeId]) => {
        const notice = notices.find((candidate) => candidate.id === noticeId);
        return notice ? (
          <Screen>
            <Heading size="lg">{notice.title}</Heading>
            <Text size="xs" className="text-muted-foreground">
              {notice.publishedAt}
            </Text>
            <Text>{notice.body}</Text>
          </Screen>
        ) : null;
      }}
    </QueryBoundary>
  );
}
