import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

/**
 * TEXT PLACEHOLDER: no official logo asset exists in the repo yet (PRD 8.1 requires the
 * supplied original image). Swap this for the real asset as-is when provided.
 */
export function BrandMark() {
  return (
    <View className="items-center gap-1" accessible accessibilityLabel="더올리브 The O'live">
      <Heading size="3xl" className="text-primary">
        더올리브
      </Heading>
      <Text size="sm" className="text-muted-foreground">
        The O&apos;live
      </Text>
    </View>
  );
}
