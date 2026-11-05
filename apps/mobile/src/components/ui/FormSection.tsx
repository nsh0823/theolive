import { Heading } from '@theolive/ui/components/heading';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

/** Flat checkout-style section: bold heading, content, hairline below (no card chrome). */
export function FormSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View className="gap-2 border-b border-border pb-5">
      <Heading size="md" accessibilityRole="header">
        {title}
      </Heading>
      {children}
    </View>
  );
}
