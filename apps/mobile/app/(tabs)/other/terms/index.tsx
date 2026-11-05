import { useRouter } from 'expo-router';

import { ListGroup } from '@/components/ui/ListGroup';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { LEGAL_DOCUMENTS } from '@/content/legal';

/** OTH-06: terms and privacy policy (static content). */
export default function TermsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ListGroup>
        {LEGAL_DOCUMENTS.map((doc) => (
          <ListRow
            key={doc.id}
            label={doc.title}
            onPress={() => router.push({ pathname: '/other/terms/[id]', params: { id: doc.id } })}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
