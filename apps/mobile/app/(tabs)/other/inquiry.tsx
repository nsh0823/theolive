import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';

import { InquiryRow } from '@/components/other/InquiryRow';
import { Card } from '@/components/ui/Card';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useInquiriesQuery, useInquiryChannelQuery } from '@/fixtures/queries';

/** OTH-04 (P1): the inquiry channel is an open decision, so the list is sample data. */
export default function InquiryScreen() {
  const router = useRouter();
  const channel = useInquiryChannelQuery();
  const inquiries = useInquiriesQuery();
  return (
    <Screen
      footer={<CtaButton label="문의하기" onPress={() => router.push('/other/inquiry-new')} />}
    >
      <QueryBoundary state={channel} emptyMessage="">
        {(info) => (
          <Card className="gap-1 bg-cream">
            <Text className="font-semibold">{info.label}</Text>
            <Text size="sm" className="text-muted-foreground">
              {info.description}
            </Text>
          </Card>
        )}
      </QueryBoundary>
      <QueryBoundary
        state={inquiries}
        isEmpty={isEmptyList}
        emptyMessage="등록한 문의가 없어요."
        emptyIcon={MessageCircle}
      >
        {(list) => list.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} />)}
      </QueryBoundary>
    </Screen>
  );
}
