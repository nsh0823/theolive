import { Text } from '@theolive/ui/components/text';

import type { PointCodeResult } from '@/models';

import { Card } from '../ui/Card';

const MESSAGE: Record<PointCodeResult['status'], string> = {
  registered: '포인트가 적립되었어요. 잔액과 내역에서 확인해 보세요.',
  invalid: '올바르지 않은 코드예요. 코드를 다시 확인해 주세요.',
  duplicate: '이미 등록된 코드예요.',
  expired: '유효기간이 지난 코드예요.',
};

/** Result of a point-code registration (PRD 5.5 RW-05). */
export function PointCodeFeedback({ result }: { result: PointCodeResult }) {
  const isSuccess = result.status === 'registered';
  return (
    <Card
      accessibilityRole={isSuccess ? 'text' : 'alert'}
      accessibilityLiveRegion="polite"
      className={isSuccess ? 'bg-secondary' : 'border-destructive'}
    >
      <Text
        className={
          isSuccess ? 'font-semibold text-secondary-foreground' : 'font-semibold text-destructive'
        }
      >
        {isSuccess ? '등록 완료' : '등록 실패'}
      </Text>
      <Text size="sm">{MESSAGE[result.status]}</Text>
    </Card>
  );
}
