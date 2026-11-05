import { Divider } from '@theolive/ui/components/divider';
import { Children, Fragment, type PropsWithChildren } from 'react';

import { Card } from './Card';

/** Card containing rows separated by hairlines. */
export function ListGroup({ children }: PropsWithChildren) {
  const rows = Children.toArray(children);
  return (
    <Card className="overflow-hidden p-0">
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider className="bg-border" /> : null}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}
