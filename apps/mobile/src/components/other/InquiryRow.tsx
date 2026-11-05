import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import type { Inquiry } from '@/models';

import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';

export function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  const status = inquiry.isAnswered ? '답변 완료' : '답변 대기';
  return (
    <Card
      className="flex-row items-center gap-3"
      accessible
      accessibilityLabel={`${inquiry.title}, ${inquiry.at}, ${status}`}
    >
      <View className="flex-1 gap-1">
        <Text className="font-semibold">{inquiry.title}</Text>
        <Text size="xs" className="text-muted-foreground">
          {inquiry.at}
        </Text>
      </View>
      <Pill label={status} tone={inquiry.isAnswered ? 'primary' : 'neutral'} />
    </Card>
  );
}
