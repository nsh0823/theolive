import { Text } from '@theolive/ui/components/text';

import { Card } from '@/components/ui/Card';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useInquiryChannelQuery } from '@/fixtures/queries';

/** OTH-04 (P1): entry point only; the channel is an open decision. */
export default function InquiryScreen() {
  const state = useInquiryChannelQuery();
  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {(channel) => (
          <Card className="gap-2">
            <Text className="font-semibold">{channel.label}</Text>
            <Text className="text-muted-foreground">{channel.description}</Text>
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}
