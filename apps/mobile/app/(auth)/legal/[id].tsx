import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';

import { EmptyView } from '@/components/ui/StateViews';
import { Screen } from '@/components/ui/Screen';
import { findLegalDocument } from '@/content/legal';
import { useRouteParam } from '@/hooks/useRouteParam';

/** Terms / privacy readable before sign-in, so consent is informed (AUTH-01). */
export default function LegalDocumentScreen() {
  const doc = findLegalDocument(useRouteParam('id') ?? undefined);
  if (!doc) return <EmptyView message="문서를 찾을 수 없어요." />;
  return (
    <Screen hasTabBar={false}>
      <Heading size="lg">{doc.title}</Heading>
      <Text>{doc.body}</Text>
    </Screen>
  );
}
