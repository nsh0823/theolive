import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { ListGroup } from '@/components/ui/ListGroup';
import { InfoRow } from '@/components/ui/ListRow';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useProfileQuery } from '@/fixtures/queries';

/** Read-only profile; identity comes from the social provider and is owned by the server. */
export default function ProfileInfoScreen() {
  const state = useProfileQuery();
  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {(profile) => (
          <View className="gap-3">
            <ListGroup>
              <InfoRow label="이름" value={profile.displayName} />
              <InfoRow label="이메일" value={profile.email} />
              <InfoRow label="로그인 방식" value={profile.loginProvider} />
            </ListGroup>
            <Text size="sm" className="px-1 text-muted-foreground">
              프로필 정보는 연결된 소셜 계정에서 가져와요.
            </Text>
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}
