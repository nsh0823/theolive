import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const BADGE_TONE = {
  NEUTRAL: 'neutral',
  PRIMARY: 'primary',
  SAGE: 'sage',
  WARNING: 'warning',
  DANGER: 'danger',
} as const;
export type BadgeTone = (typeof BADGE_TONE)[keyof typeof BADGE_TONE];

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-background text-muted-foreground ring-1 ring-border',
  primary: 'bg-primary text-primary-foreground',
  sage: 'bg-secondary text-secondary-foreground',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
};

type BadgeProps = { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string };

/** Status is always text (plus an optional icon), never color alone. */
export function Badge({ tone = BADGE_TONE.NEUTRAL, icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
