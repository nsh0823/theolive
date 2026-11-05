import { Divider } from '@theolive/ui/components/divider';
import { Heading } from '@theolive/ui/components/heading';
import { Children, Fragment, type PropsWithChildren } from 'react';
import { View } from 'react-native';

/** Flat list on the canvas: bold section title, rows separated by hairlines (no card). */
export function ListGroup({ children, title }: PropsWithChildren<{ title?: string }>) {
  const rows = Children.toArray(children);
  return (
    <View className="gap-1">
      {title ? (
        <Heading size="md" accessibilityRole="header">
          {title}
        </Heading>
      ) : null}
      <View>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <Divider className="bg-border" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}
