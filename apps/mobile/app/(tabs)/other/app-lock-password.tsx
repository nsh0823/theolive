import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { useEffect, useReducer } from 'react';
import { View } from 'react-native';

import { PinPad } from '@/components/other/PinPad';
import { Screen } from '@/components/ui/Screen';
import { INITIAL_PIN_FLOW, isPinConfirmed, pinFlowReducer } from '@/lib/pin';
import { useAppLockStore } from '@/store/useAppLockStore';

/** Set or change the app password (enter, then confirm). UI stub: the PIN is never stored. */
export default function AppLockPasswordScreen() {
  const router = useRouter();
  const [flow, dispatch] = useReducer(pinFlowReducer, INITIAL_PIN_FLOW);
  const { hasPassword, markPasswordSet } = useAppLockStore();
  const confirmed = isPinConfirmed(flow);

  useEffect(() => {
    if (!confirmed) return;
    markPasswordSet();
    router.back();
  }, [confirmed, markPasswordSet, router]);

  const title = flow.step === 'enter' ? '새 비밀번호를 입력해 주세요' : '한 번 더 입력해 주세요';
  return (
    <Screen>
      <View className="items-center gap-2 py-6">
        <Heading size="lg" accessibilityRole="header">
          {title}
        </Heading>
        <Text className="text-muted-foreground">
          {hasPassword ? '비밀번호를 변경해요.' : '숫자 4자리로 설정해요.'}
        </Text>
        {flow.error ? (
          <Text className="text-center text-destructive" accessibilityRole="alert">
            {flow.error}
          </Text>
        ) : null}
      </View>
      <PinPad
        entryLength={flow.entry.length}
        onDigit={(value) => dispatch({ type: 'digit', value })}
        onDelete={() => dispatch({ type: 'delete' })}
      />
    </Screen>
  );
}
