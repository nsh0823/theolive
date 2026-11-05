import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';

import { Card } from '@/components/ui/Card';
import { CtaButton } from '@/components/ui/CtaButton';
import { Screen } from '@/components/ui/Screen';

/** UI only: nothing is sent until the inquiry channel is decided (OTH-04). */
export default function InquiryNewScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  return (
    <Screen
      footer={
        <CtaButton
          label="문의 접수하기"
          isDisabled={!canSubmit}
          onPress={() => setNotice('문의 접수 채널이 아직 연결되지 않아 전송되지 않았어요.')}
        />
      }
    >
      <Input className="min-h-12 rounded-md bg-card">
        <InputField
          placeholder="제목"
          value={title}
          onChangeText={setTitle}
          aria-label="문의 제목"
        />
      </Input>
      <Input className="min-h-40 rounded-md bg-card">
        <InputField
          placeholder="문의 내용을 입력해 주세요"
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          aria-label="문의 내용"
        />
      </Input>
      {notice ? (
        <Card className="bg-secondary" accessibilityLiveRegion="polite">
          <Text className="text-secondary-foreground">{notice}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
