import { isNetworkError } from '@theolive/api';
import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { LedgerList } from '@/components/reward/LedgerRow';
import { StampCard } from '@/components/reward/StampCard';
import { StampExchangeRow } from '@/components/reward/StampExchangeRow';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import {
  useRedeemStampsMutation,
  useStampExchangeQuery,
  useStampLedgerQuery,
  useStampsQuery,
} from '@/hooks/useRewards';
import { userMessage } from '@/lib/errorMessage';
import { combineStates } from '@/lib/queryState';
import { createRequestId } from '@/lib/uuid';
import type { StampExchangeOption } from '@/models';

export default function StampsScreen() {
  const router = useRouter();
  const state = combineStates(useStampsQuery(), useStampExchangeQuery());
  const ledger = useStampLedgerQuery();
  const redeem = useRedeemStampsMutation();
  const [pending, setPending] = useState<StampExchangeOption | null>(null);
  const [exchangedTitle, setExchangedTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // One request id per exchange attempt (RW-02): a retry after a lost answer replays instead of exchanging twice.
  const attempts = useRef(new Map<string, string>());
  const inFlight = useRef(false);

  // The server verifies the balance, deducts the stamps and issues the coupon in one step.
  const confirmExchange = async () => {
    if (!pending || inFlight.current) return;
    const option = pending;
    inFlight.current = true;
    setPending(null);
    setErrorMessage(null);
    setExchangedTitle(null);
    const clientRequestId = attempts.current.get(option.id) ?? createRequestId();
    attempts.current.set(option.id, clientRequestId);
    try {
      await redeem.mutateAsync({ couponId: option.id, clientRequestId });
      attempts.current.delete(option.id);
      setExchangedTitle(option.title);
    } catch (error) {
      console.error('stamps: exchange failed', error);
      // The outcome is unknown after a lost connection, so that attempt keeps its id; any server answer ends it.
      if (!isNetworkError(error)) attempts.current.delete(option.id);
      setErrorMessage(userMessage(error));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {([stamps, options]) => (
          <>
            <StampCard stamps={stamps} />
            {exchangedTitle ? (
              <Card
                className="gap-2 rounded-2xl border-0 bg-secondary"
                accessibilityLiveRegion="polite"
              >
                <Text className="font-semibold text-secondary-foreground">
                  {exchangedTitle}으로 교환했어요.
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
