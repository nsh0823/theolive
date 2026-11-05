import { Text } from '@theolive/ui/components/text';

import { Card } from '@/components/ui/Card';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { INQUIRY_CHANNEL } from '@/content/inquiry';
import { useStorePhoneQuery } from '@/hooks/useStorePhone';

/** OTH-04: no in-app inquiry system in the MVP; the member is pointed to the store's phone. */
export default function InquiryScreen() {
  const phone = useStorePhoneQuery();
  return (
    <Screen>
      <Card className="gap-1 bg-cream">
        <Text className="font-semibold">{INQUIRY_CHANNEL.label}</Text>
        <Text size="sm" className="text-muted-foreground">
          {INQUIRY_CHANNEL.description}
        </Text>
      </Card>
      <QueryBoundary state={phone} emptyMessage="">
        {(number) => (
          <Card className="gap-1" accessible accessibilityLabel={`매장 전화번호 ${number}`}>
            <Text size="sm" className="text-muted-foreground">
              매장 전화번호
            </Text>
            <Text className="text-lg font-bold text-primary">{number}</Text>
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}
