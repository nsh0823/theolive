import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useState } from 'react';

import { LedgerList } from '@/components/reward/LedgerRow';
import { StampCard } from '@/components/reward/StampCard';
import { Card } from '@/components/ui/Card';
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
  const [requestedTitle, setRequestedTitle] = useState<string | null>(null);

  // The server verifies balance and conditions, then deducts stamps and issues the coupon (RW-02).
  const exchange = async (option: StampExchangeOption) => {
    try {
      await requestStampExchange(option.id);
      setRequestedTitle(option.title);
    } catch (error) {
      console.error('stamps: exchange request failed', error);
      Alert.alert('교환하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  const confirmExchange = (option: StampExchangeOption) =>
    Alert.alert(
      '쿠폰으로 교환할까요?',
      `스탬프 ${option.requiredStamps}개로 ${option.title}을(를) 받아요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '교환', onPress: () => void exchange(option) },
      ],
    );

  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {([stamps, options]) => (
          <>
            <StampCard stamps={stamps} />
            {requestedTitle ? (
              <Card className="gap-2 bg-secondary" accessibilityLiveRegion="polite">
                <Text className="font-semibold text-secondary-foreground">
                  {requestedTitle} 교환을 요청했어요.
                </Text>
                <CtaButton
                  label="보유 쿠폰 보기"
                  variant="outline"
                  onPress={() => router.push('/reward/coupons')}
                />
              </Card>
            ) : null}
            <Heading size="md" accessibilityRole="header">
              쿠폰 교환
            </Heading>
            {options.map((option) => {
              const canExchange = stamps.count >= option.requiredStamps;
              return (
                <Card key={option.id} className="gap-3">
                  <View className="gap-1">
                    <Text className="font-semibold">{option.title}</Text>
                    <Text size="sm" className="text-muted-foreground">
                      스탬프 {option.requiredStamps}개 필요
                      {canExchange
                        ? ''
                        : ` · ${option.requiredStamps - stamps.count}개 더 필요해요`}
                    </Text>
                  </View>
                  <CtaButton
                    label="교환하기"
                    variant="secondary"
                    isDisabled={!canExchange}
                    onPress={() => confirmExchange(option)}
                  />
                </Card>
              );
            })}
          </>
        )}
      </QueryBoundary>
      <Heading size="md" accessibilityRole="header">
        스탬프 내역
      </Heading>
      <QueryBoundary state={ledger} isEmpty={isEmptyList} emptyMessage="스탬프 적립 내역이 없어요.">
        {(entries) => <LedgerList entries={entries} unit="stamp" />}
      </QueryBoundary>
    </Screen>
  );
}
