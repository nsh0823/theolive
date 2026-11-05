import { Heading } from '@theolive/ui/components/heading';
import { useRouter } from 'expo-router';

import { LedgerList } from '@/components/reward/LedgerRow';
import { PointBalanceCard } from '@/components/reward/PointBalanceCard';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { usePointLedgerQuery, usePointsQuery } from '@/fixtures/queries';

/** RW-06: balance plus issue / use / cancel ledger. */
export default function PointsScreen() {
  const router = useRouter();
  const points = usePointsQuery();
  const ledger = usePointLedgerQuery();

  return (
    <Screen>
      <QueryBoundary state={points} emptyMessage="">
        {(data) => <PointBalanceCard points={data} />}
      </QueryBoundary>
      <CtaButton
        label="포인트 코드 등록"
        variant="secondary"
        onPress={() => router.push('/reward/point-code')}
      />
      <Heading size="md" accessibilityRole="header">
        적립 / 사용 내역
      </Heading>
      <QueryBoundary state={ledger} isEmpty={isEmptyList} emptyMessage="포인트 내역이 없어요.">
        {(entries) => <LedgerList entries={entries} unit="won" />}
      </QueryBoundary>
    </Screen>
  );
}
