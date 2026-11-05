import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function DataTable({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border px-3 py-3 text-xs font-semibold whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-border px-3 py-3 align-middle', className)} {...rest} />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-background/60', className)} {...rest} />;
}
