import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

export function ChipRow({ children }: PropsWithChildren) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-5 py-1"
      className="-mx-5 grow-0"
    >
      {children}
    </ScrollView>
  );
}
