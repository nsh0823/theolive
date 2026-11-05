import { completeOAuthSignIn } from '@theolive/api';
import { APP_ERROR, APP_ERROR_MESSAGE } from '@theolive/types';
import { Text } from '@theolive/ui/components/text';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/services/supabase';

/** OAuth redirect target (`theolive://callback?code=...`): trades the one-time code for a session. */
export default function OAuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let isActive = true;
    completeOAuthSignIn(supabase, code).catch((caught: unknown) => {
      console.error('OAuth code exchange failed', caught);
      if (isActive) setError(APP_ERROR_MESSAGE[APP_ERROR.INTERNAL]);
    });
    // On success the session listener swaps the protected route group, which leaves this screen.
    return () => {
      isActive = false;
    };
  }, [code]);

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text accessibilityLiveRegion="polite" className="text-center text-muted-foreground">
        {(code ? error : APP_ERROR_MESSAGE[APP_ERROR.INVALID_INPUT]) ?? '로그인하고 있어요…'}
      </Text>
    </View>
  );
}
