import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Link, type Href } from 'expo-router';
import { View } from 'react-native';

type Props = { title: string; actionLabel?: string; actionHref?: Href };

export function SectionHeader({ title, actionLabel, actionHref }: Props) {
  return (
    <View className="flex-row items-center justify-between">
      <Heading size="md" accessibilityRole="header">
        {title}
      </Heading>
      {actionLabel && actionHref ? (
        <Link href={actionHref} accessibilityRole="link" className="min-h-11 py-3">
          <Text size="sm" className="font-semibold text-primary">
            {actionLabel}
          </Text>
        </Link>
      ) : null}
    </View>
  );
}
