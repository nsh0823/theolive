import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CheckRow } from '../ui/CheckRow';

type Props = {
  termsChecked: boolean;
  privacyChecked: boolean;
  onToggleTerms: () => void;
  onTogglePrivacy: () => void;
};

/** Required consent before any social login; each document is readable from here. */
export function ConsentSection({
  termsChecked,
  privacyChecked,
  onToggleTerms,
  onTogglePrivacy,
}: Props) {
  const router = useRouter();
  const open = (id: 'terms' | 'privacy') =>
    router.push({ pathname: '/legal/[id]', params: { id } });
  return (
    <View className="gap-1">
      <View className="flex-row items-center">
        <View className="flex-1">
          <CheckRow
            label="이용약관에 동의합니다"
            badge="(필수)"
            checked={termsChecked}
            onToggle={onToggleTerms}
          />
        </View>
        <Pressable
          onPress={() => open('terms')}
          accessibilityRole="link"
          accessibilityLabel="이용약관 보기"
          className="min-h-11 justify-center px-2"
        >
          <Text size="sm" className="text-muted-foreground underline">
            보기
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center">
        <View className="flex-1">
          <CheckRow
            label="개인정보 처리방침에 동의합니다"
            badge="(필수)"
            checked={privacyChecked}
            onToggle={onTogglePrivacy}
          />
        </View>
        <Pressable
          onPress={() => open('privacy')}
          accessibilityRole="link"
          accessibilityLabel="개인정보 처리방침 보기"
          className="min-h-11 justify-center px-2"
        >
          <Text size="sm" className="text-muted-foreground underline">
            보기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
