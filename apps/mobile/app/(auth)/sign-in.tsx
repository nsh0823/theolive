import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsentSection } from '@/components/auth/ConsentSection';
import { DevEmailSignIn } from '@/components/auth/DevEmailSignIn';
import { SOCIAL_PROVIDERS, SocialLoginButton } from '@/components/auth/SocialLoginButton';
import { BrandMark } from '@/components/ui/BrandMark';

/** AUTH-01 UI. OAuth is not wired yet, so provider buttons only surface a notice. */
export default function SignInScreen() {
  const [notice, setNotice] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const insets = useSafeAreaInsets();
  const hasConsent = termsChecked && privacyChecked;

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
          contentContainerClassName="flex-grow justify-center gap-8 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-4">
            <BrandMark />
            <View className="items-center gap-1">
              <Heading size="xl">더올리브에 오신 걸 환영해요</Heading>
              <Text className="text-center text-muted-foreground">
                미리 주문하고, 스탬프도 모으고, 편하게 픽업하세요.
              </Text>
            </View>
          </View>
          <ConsentSection
            termsChecked={termsChecked}
            privacyChecked={privacyChecked}
            onToggleTerms={() => setTermsChecked((value) => !value)}
            onTogglePrivacy={() => setPrivacyChecked((value) => !value)}
          />
          <View className="gap-3">
            {SOCIAL_PROVIDERS.map((provider) => (
              <SocialLoginButton
                key={provider.id}
                label={provider.label}
                isDisabled={!hasConsent}
                onPress={() => setNotice('소셜 로그인은 아직 연결되지 않았어요.')}
              />
            ))}
            <Text
              size="sm"
              className="text-center text-muted-foreground"
              accessibilityLiveRegion="polite"
            >
              {notice ?? (hasConsent ? '' : '필수 약관에 동의하면 로그인할 수 있어요.')}
            </Text>
          </View>
          {__DEV__ ? <DevEmailSignIn /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
