import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = { children: ReactNode; className?: string };

export function Card({ children, className }: CardProps) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
      {children}
    </section>
  );
}

type CardHeaderProps = { icon?: ReactNode; title: string; action?: ReactNode };

/** Icon + title, then a hairline (layout reference). */
export function CardHeader({ icon, title, action }: CardHeaderProps) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        {icon ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {action}
    </header>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

type StatFigureProps = { value: string; label: string };

export function StatFigure({ value, label }: StatFigureProps) {
  return (
    <div className="min-w-0 flex-1 px-5 py-4 first:pl-0">
      <p className="truncate text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Stat figures split by vertical dividers (layout reference). */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex divide-x divide-border px-5">{children}</div>;
}
