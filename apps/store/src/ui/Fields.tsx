import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const CONTROL_CLASS =
  'h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-2 disabled:bg-background disabled:opacity-60';

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

function FieldShell({ id, label, hint, error, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SharedFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
};

function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...rest
}: SharedFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_CLASS, className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  children,
  ...rest
}: SharedFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <select
        id={id}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_CLASS, className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...rest
}: SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_CLASS, 'min-h-24 py-2.5', className)}
        {...rest}
      />
    </FieldShell>
  );
}
