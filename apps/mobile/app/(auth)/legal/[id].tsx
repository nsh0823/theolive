import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';

import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useTermsQuery } from '@/fixtures/queries';
import { useRouteParam } from '@/hooks/useRouteParam';
import { combineStates, successState } from '@/lib/queryState';

/** Terms / privacy readable before sign-in, so consent is informed (AUTH-01). */
export default function LegalDocumentScreen() {
  const id = useRouteParam('id');
  const state = combineStates(useTermsQuery(), successState(id));
  return (
    <QueryBoundary
      state={state}
      isEmpty={([docs, docId]) => !docs.some((doc) => doc.id === docId)}
      emptyMessage="문서를 찾을 수 없어요."
    >
      {([docs, docId]) => {
        const doc = docs.find((candidate) => candidate.id === docId);
        return doc ? (
          <Screen hasTabBar={false}>
            <Heading size="lg">{doc.title}</Heading>
            <Text>{doc.body}</Text>
          </Screen>
        ) : null;
      }}
    </QueryBoundary>
  );
}
