import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const BUTTON_VARIANT = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  OUTLINE: 'outline',
  GHOST: 'ghost',
  DANGER: 'danger',
} as const;
export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

export const BUTTON_SIZE = { SM: 'sm', MD: 'md', LG: 'lg' } as const;
export type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE];

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  outline: 'border border-border bg-card text-foreground hover:bg-background',
  ghost: 'text-foreground hover:bg-background',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

// LG is the Store Web size: 48px tall (touch target). MD is 44px, SM is for dense desktop tables only.
const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

/** Class string for links that should look like buttons (avoids a button nested inside an anchor). */
export function buttonClasses(
  variant: ButtonVariant = BUTTON_VARIANT.PRIMARY,
  size: ButtonSize = BUTTON_SIZE.MD,
): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = BUTTON_VARIANT.PRIMARY,
  size = BUTTON_SIZE.MD,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:opacity-50',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  children: ReactNode;
  variant?: ButtonVariant;
};

export function IconButton({
  label,
  children,
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50',
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
