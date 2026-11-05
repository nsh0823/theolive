import { AppError } from '@theolive/api';
import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { PointCodeFeedback, type PointCodeOutcome } from '@/components/reward/PointCodeFeedback';
import { CtaButton } from '@/components/ui/CtaButton';
import { Screen } from '@/components/ui/Screen';
import { useRegisterPointCodeMutation } from '@/hooks/usePoints';

/**
 * RW-05: the server normalizes and checks the code (format, expiry, already used, void) and limits wrong entries
 * per account; the client only blocks empty input and shows the server's reason.
 */
export default function PointCodeScreen() {
  const router = useRouter();
  const register = useRegisterPointCodeMutation();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<PointCodeOutcome | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (inFlight.current || trimmed.length === 0) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      const registered = await register.mutateAsync(trimmed);
      setResult({ status: 'registered', amount: registered.amount });
      setCode('');
    } catch (error) {
      // A refused code is something the member can act on and is shown; anything else is unexpected.
      if (!(error instanceof AppError)) console.error('point-code: registration failed', error);
      setResult({ status: 'failed', error });
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text className="text-muted-foreground">발급받은 쿠폰 포인트 코드를 입력해 주세요.</Text>
      <Input className="min-h-12 rounded-md bg-card">
        <InputField
          placeholder="OLIVE-XXXX-XXXX"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          aria-label="포인트 코드 입력"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </Input>
      {result ? <PointCodeFeedback result={result} /> : null}
      {result?.status === 'registered' ? (
        <CtaButton
          label="포인트 내역 보기"
          variant="outline"
          onPress={() => router.replace('/reward/points')}
        />
      ) : null}
      <CtaButton
        label="등록하기"
        onPress={() => void submit()}
        isLoading={isSubmitting}
        isDisabled={code.trim().length === 0}
      />
    </Screen>
  );
}
