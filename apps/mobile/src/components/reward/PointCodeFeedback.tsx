import { Text } from '@theolive/ui/components/text';

import { userMessage } from '@/lib/errorMessage';
import { formatWon } from '@/lib/format';

import { Card } from '../ui/Card';

/** Result of a point-code registration (PRD 5.5 RW-05): the credited points, or the reason it was refused. */
export type PointCodeOutcome =
  { status: 'registered'; amount: number } | { status: 'failed'; error: unknown };

export function PointCodeFeedback({ result }: { result: PointCodeOutcome }) {
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
      <Text size="sm">
        {result.status === 'registered'
          ? `${formatWon(result.amount)}이 적립되었어요. 잔액과 내역에서 확인해 보세요.`
          : userMessage(result.error)}
      </Text>
    </Card>
  );
}
