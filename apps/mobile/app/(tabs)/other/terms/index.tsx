import { useRouter } from 'expo-router';

import { ListGroup } from '@/components/ui/ListGroup';
import { ListRow } from '@/components/ui/ListRow';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useTermsQuery } from '@/fixtures/queries';

/** OTH-06: terms and privacy policy. */
export default function TermsScreen() {
  const router = useRouter();
  const state = useTermsQuery();
  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {(documents) => (
          <ListGroup>
            {documents.map((doc) => (
              <ListRow
                key={doc.id}
                label={doc.title}
                onPress={() =>
                  router.push({ pathname: '/other/terms/[id]', params: { id: doc.id } })
                }
              />
            ))}
          </ListGroup>
        )}
      </QueryBoundary>
    </Screen>
  );
}
