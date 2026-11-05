import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LedgerList } from '@/components/reward/LedgerRow';
import { StampCard } from '@/components/reward/StampCard';
import { StampExchangeRow } from '@/components/reward/StampExchangeRow';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { requestStampExchange } from '@/fixtures/actions';
import { useStampExchangeQuery, useStampLedgerQuery, useStampsQuery } from '@/fixtures/queries';
import { combineStates } from '@/lib/queryState';
import type { StampExchangeOption } from '@/models';

export default function StampsScreen() {
  const router = useRouter();
  const state = combineStates(useStampsQuery(), useStampExchangeQuery());
  const ledger = useStampLedgerQuery();
  const [pending, setPending] = useState<StampExchangeOption | null>(null);
  const [requestedTitle, setRequestedTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The server verifies balance and conditions, then deducts stamps and issues the coupon (RW-02).
  const confirmExchange = async () => {
    if (!pending) return;
    const option = pending;
    setPending(null);
    setErrorMessage(null);
    try {
      await requestStampExchange(option.id);
      setRequestedTitle(option.title);
    } catch (error) {
      console.error('stamps: exchange request failed', error);
      setErrorMessage('교환하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {([stamps, options]) => (
          <>
            <StampCard stamps={stamps} />
            {requestedTitle ? (
              <Card
                className="gap-2 rounded-2xl border-0 bg-secondary"
                accessibilityLiveRegion="polite"
              >
                <Text className="font-semibold text-secondary-foreground">
                  {requestedTitle} 교환을 요청했어요.
                </Text>
                <CtaButton
                  label="내 쿠폰 보기"
                  variant="outline"
                  onPress={() => router.push('/reward/coupons')}
                />
              </Card>
            ) : null}
            {errorMessage ? (
              <Text className="text-destructive" accessibilityRole="alert">
                {errorMessage}
              </Text>
            ) : null}
            <Heading size="md" accessibilityRole="header">
              쿠폰 교환
            </Heading>
            <View className="gap-3">
              {options.map((option) => (
                <StampExchangeRow
                  key={option.id}
                  option={option}
                  stampCount={stamps.count}
                  onExchange={() => setPending(option)}
                />
              ))}
            </View>
          </>
        )}
      </QueryBoundary>
      <Heading size="md" accessibilityRole="header">
        스탬프 내역
      </Heading>
      <QueryBoundary state={ledger} isEmpty={isEmptyList} emptyMessage="스탬프 적립 내역이 없어요.">
        {(entries) => <LedgerList entries={entries} unit="stamp" />}
      </QueryBoundary>
      <ConfirmDialog
        visible={pending !== null}
        title="쿠폰으로 교환할까요?"
        message={
          pending
            ? `스탬프 ${pending.requiredStamps}개로 ${pending.title}을(를) 받아요. 교환하면 스탬프가 차감돼요.`
            : undefined
        }
        confirmLabel="교환하기"
        onConfirm={() => void confirmExchange()}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}
