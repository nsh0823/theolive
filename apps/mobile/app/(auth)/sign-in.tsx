import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DevEmailSignIn } from '@/components/auth/DevEmailSignIn';
import { SOCIAL_PROVIDERS, SocialLoginButton } from '@/components/auth/SocialLoginButton';
import { BrandMark } from '@/components/ui/BrandMark';

/** AUTH-01 UI. OAuth is not wired yet, so provider buttons only surface a notice. */
export default function SignInScreen() {
  const [notice, setNotice] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-10 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <BrandMark />
          <View className="gap-3">
            {SOCIAL_PROVIDERS.map((provider) => (
              <SocialLoginButton
                key={provider.id}
                label={provider.label}
                onPress={() => setNotice('소셜 로그인은 아직 연결되지 않았어요.')}
              />
            ))}
            {notice ? (
              <Text
                size="sm"
                className="text-center text-muted-foreground"
                accessibilityLiveRegion="polite"
              >
                {notice}
              </Text>
            ) : null}
          </View>
          {__DEV__ ? <DevEmailSignIn /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
