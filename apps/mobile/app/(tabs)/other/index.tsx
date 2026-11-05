import { Heading } from '@theolive/ui/components/heading';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Bell,
  FileText,
  Fingerprint,
  Megaphone,
  MessageCircle,
  Receipt,
  ShieldCheck,
} from 'lucide-react-native';
import { Alert } from 'react-native';

import { requestAccountDeletion } from '@/fixtures/actions';
import { useProfileQuery } from '@/fixtures/queries';
import { useSignOut } from '@/hooks/useAuth';
import { InfoRow, ListRow } from '@/components/ui/ListRow';
import { ListGroup } from '@/components/ui/ListGroup';
import { Screen } from '@/components/ui/Screen';

export default function OtherScreen() {
  const router = useRouter();
  const profile = useProfileQuery();
  const signOut = useSignOut();
  const version = Constants.expoConfig?.version ?? '-';

  // OTH-08: both destructive actions ask for confirmation first.
  const confirmLogout = () =>
    Alert.alert('로그아웃할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => signOut.mutate() },
    ]);

  const confirmDeletion = () =>
    Alert.alert('회원 탈퇴', '탈퇴하면 정책에 따라 계정과 개인정보가 처리돼요. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: () =>
          void requestAccountDeletion().catch((error: unknown) => {
            console.error('other: account deletion request failed', error);
            Alert.alert('탈퇴 요청에 실패했어요', '잠시 후 다시 시도해 주세요.');
          }),
      },
    ]);

  return (
    <Screen>
      <Heading size="lg">
        {profile.status === 'success' ? `${profile.data.displayName}님` : '내 계정'}
      </Heading>
      <ListGroup>
        <ListRow label="주문 내역" icon={Receipt} onPress={() => router.push('/other/orders')} />
        <ListRow label="공지사항" icon={Megaphone} onPress={() => router.push('/other/notices')} />
        <ListRow
          label="문의하기"
          icon={MessageCircle}
          onPress={() => router.push('/other/inquiry')}
        />
      </ListGroup>
      <ListGroup>
        <ListRow
          label="알림 설정"
          icon={Bell}
          onPress={() => router.push('/other/notification-settings')}
        />
        <ListRow
          label="앱 잠금 / 생체 인증"
          icon={Fingerprint}
          onPress={() => router.push('/other/app-lock')}
        />
        <ListRow label="이용약관" icon={FileText} onPress={() => router.push('/other/terms')} />
        <InfoRow label="앱 버전" value={version} />
      </ListGroup>
      <ListGroup>
        <ListRow label="로그아웃" icon={ShieldCheck} showChevron={false} onPress={confirmLogout} />
        <ListRow label="회원 탈퇴" destructive showChevron={false} onPress={confirmDeletion} />
      </ListGroup>
    </Screen>
  );
}
