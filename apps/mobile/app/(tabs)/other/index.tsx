import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Bell,
  FileText,
  Fingerprint,
  Lock,
  Megaphone,
  Pencil,
  MessageCircle,
  Receipt,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useAccountDialogs } from '@/components/other/AccountDialogs';
import { LinkGrid } from '@/components/other/LinkGrid';
import { ShortcutTiles } from '@/components/other/ShortcutTiles';
import { Screen } from '@/components/ui/Screen';
import { useProfileQuery } from '@/hooks/useProfileQuery';

export default function OtherScreen() {
  const router = useRouter();
  const profile = useProfileQuery();
  const { dialogs, askLogout, askDeletion, askNickname } = useAccountDialogs();
  const version = Constants.expoConfig?.version ?? '-';
  const name = profile.status === 'success' ? profile.data.displayName : '내 계정';
  const provider = profile.status === 'success' ? `${profile.data.loginProvider} 로그인` : '';

  return (
    <Screen>
      <Pressable
        onPress={() => router.push('/other/profile')}
        accessibilityRole="button"
        accessibilityLabel={`${name}님, ${provider}, 프로필 정보 보기`}
        className="min-h-20 items-center justify-center gap-1 py-2"
      >
        <Heading size="2xl" className="text-center">
          <Heading size="2xl" className="text-primary">
            {name}
          </Heading>{' '}
          님
        </Heading>
        <Text className="text-muted-foreground">환영합니다!</Text>
      </Pressable>

      <ShortcutTiles
        items={[
          { label: '주문 내역', icon: Receipt, onPress: () => router.push('/other/orders') },
          { label: '프로필 정보', icon: UserRound, onPress: () => router.push('/other/profile') },
          {
            label: '알림 설정',
            icon: Bell,
            onPress: () => router.push('/other/notification-settings'),
          },
        ]}
      />

      <View className="gap-4">
        <LinkGrid
          title="고객 지원"
          items={[
            { label: '공지사항', icon: Megaphone, onPress: () => router.push('/other/notices') },
            { label: '문의', icon: MessageCircle, onPress: () => router.push('/other/inquiry') },
          ]}
        />
        <LinkGrid
          title="설정"
          items={[
            { label: '닉네임 변경', icon: Pencil, onPress: askNickname },
            {
              label: '앱 비밀번호 잠금',
              icon: Lock,
              onPress: () => router.push('/other/app-lock'),
            },
            {
              label: '생체 인증 (Face ID / 지문)',
              icon: Fingerprint,
              onPress: () => router.push('/other/biometric'),
            },
          ]}
        />
        <LinkGrid
          title="앱 정보"
          isLast
          items={[
            {
              label: '이용약관',
              icon: FileText,
              onPress: () =>
                router.push({ pathname: '/other/terms/[id]', params: { id: 'terms' } }),
            },
            {
              label: '개인정보 처리방침',
              icon: ShieldCheck,
              onPress: () =>
                router.push({ pathname: '/other/terms/[id]', params: { id: 'privacy' } }),
            },
            { label: '앱 버전', icon: FileText, value: version },
          ]}
        />
      </View>

      <View className="flex-row items-center justify-center">
        <Pressable
          onPress={askLogout}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          className="min-h-11 justify-center px-4"
        >
          <Text size="sm" className="text-muted-foreground underline">
            로그아웃
          </Text>
        </Pressable>
        <View className="h-3 w-px bg-border" />
        <Pressable
          onPress={askDeletion}
          accessibilityRole="button"
          accessibilityLabel="회원 탈퇴"
          className="min-h-11 justify-center px-4"
        >
          <Text size="sm" className="text-destructive underline">
            회원 탈퇴
          </Text>
        </Pressable>
      </View>
      {dialogs}
    </Screen>
  );
}
