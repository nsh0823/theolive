import { Box } from '@theolive/ui/components/box';
import type { ComponentProps } from 'react';

/** DESIGN.md Level 1 surface: white, hairline border, 16px radius. */
export function Card({ className, ...props }: ComponentProps<typeof Box>) {
  return (
    <Box className={`rounded-lg border border-border bg-card p-4 ${className ?? ''}`} {...props} />
  );
}
