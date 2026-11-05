import { startOAuthSignIn } from '@theolive/api';
import { APP_ERROR_MESSAGE } from '@theolive/types';
import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsentSection } from '@/components/auth/ConsentSection';
import { DevEmailSignIn } from '@/components/auth/DevEmailSignIn';
import {
  SOCIAL_PROVIDERS,
  SocialLoginButton,
  type SocialProviderId,
} from '@/components/auth/SocialLoginButton';
import { BrandMark } from '@/components/ui/BrandMark';
import { env } from '@/env';
import { useSession } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';

// Required by Expo so a pending auth session completes when the app is reopened through the redirect.
WebBrowser.maybeCompleteAuthSession();

const OAUTH_CALLBACK_PATH = 'callback';
const SOCIAL_FAILED = '로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';

function readAuthCode(url: string): string | null {
  const code = Linking.parse(url).queryParams?.code;
  return typeof code === 'string' && code !== '' ? code : null;
}

/**
 * AUTH-01. Providers are configured in Supabase Auth; the redirect returns to `(auth)/callback`.
 * Not verified against real Kakao/Google/Apple apps locally.
 */
export default function SignInScreen() {
  const [notice, setNotice] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rejection, clearRejection } = useSession();
  const hasConsent = termsChecked && privacyChecked;

  useEffect(() => clearRejection, [clearRejection]);

  async function startSocialSignIn(provider: SocialProviderId): Promise<void> {
    setNotice(null);
    try {
      const redirectTo = Linking.createURL(OAUTH_CALLBACK_PATH);
      const url = await startOAuthSignIn(supabase, provider, redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      // A user cancel or dismiss is not an error: stay on the screen without a message.
      if (result.type !== 'success') return;
      const code = readAuthCode(result.url);
      if (!code) {
        setNotice(SOCIAL_FAILED);
        return;
      }
      router.replace({ pathname: '/callback', params: { code } });
    } catch (error) {
      console.error('Starting social sign-in failed', error);
      setNotice(SOCIAL_FAILED);
    }
  }

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
                onPress={() => void startSocialSignIn(provider.id)}
              />
            ))}
            <Text
              size="sm"
              className="text-center text-muted-foreground"
              accessibilityLiveRegion="polite"
            >
              {(rejection ? APP_ERROR_MESSAGE[rejection] : null) ??
                notice ??
                (hasConsent ? '' : '필수 약관에 동의하면 로그인할 수 있어요.')}
            </Text>
          </View>
          {__DEV__ && env.enableDevLogin ? <DevEmailSignIn /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
