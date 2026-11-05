import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { useRef, useState } from 'react';

import { PointCodeFeedback } from '@/components/reward/PointCodeFeedback';
import { CtaButton } from '@/components/ui/CtaButton';
import { Screen } from '@/components/ui/Screen';
import { registerPointCode } from '@/fixtures/actions';
import type { PointCodeResult } from '@/models';

/** RW-05: the server validates format, expiry, and duplicates; the client only blocks empty input. */
export default function PointCodeScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<PointCodeResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (inFlight.current || trimmed.length === 0) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      setResult(await registerPointCode(trimmed));
    } catch (error) {
      console.error('point-code: registration request failed', error);
      setResult({ status: 'invalid' });
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
          placeholder="포인트 코드"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="포인트 코드 입력"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </Input>
      {result ? <PointCodeFeedback result={result} /> : null}
      <CtaButton
        label="등록하기"
        onPress={() => void submit()}
        isLoading={isSubmitting}
        isDisabled={code.trim().length === 0}
      />
    </Screen>
  );
}
