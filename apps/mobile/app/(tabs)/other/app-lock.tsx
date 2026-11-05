import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';

import { SettingSwitchRow } from '@/components/other/SettingSwitchRow';
import { ListGroup } from '@/components/ui/ListGroup';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { useAppLockStore } from '@/store/useAppLockStore';

/**
 * AUTH-05 (P1) UI only. App lock is a local guard separate from the server login. Turning it
 * on without a password sends the user to set one first. State is in memory, not persisted.
 */
export default function AppLockScreen() {
  const router = useRouter();
  const { hasPassword, lockEnabled, setLockEnabled } = useAppLockStore();

  const toggleLock = (next: boolean) => {
    if (next && !hasPassword) {
      router.push('/other/app-lock-password');
      return;
    }
    setLockEnabled(next);
  };

  return (
    <Screen>
      <ListGroup>
        <SettingSwitchRow
          label="앱 비밀번호 잠금"
          description={lockEnabled ? '사용 중' : '사용 안 함'}
          value={lockEnabled}
          onValueChange={toggleLock}
        />
        <ListRow
          label={hasPassword ? '비밀번호 변경' : '비밀번호 설정'}
          icon={KeyRound}
          onPress={() => router.push('/other/app-lock-password')}
        />
        <ListRow label="생체 인증 설정" onPress={() => router.push('/other/biometric')} />
      </ListGroup>
      <Text size="sm" className="text-muted-foreground">
        잠금을 켜면 앱을 다시 열 때 비밀번호를 입력해야 해요. 로그인 상태는 그대로 유지돼요.
      </Text>
    </Screen>
  );
}
