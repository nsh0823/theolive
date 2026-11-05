import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

export const DIALOG_PLACEMENT = { CENTER: 'center', RIGHT: 'right' } as const;
export type DialogPlacement = (typeof DIALOG_PLACEMENT)[keyof typeof DIALOG_PLACEMENT];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  placement?: DialogPlacement;
  /** Tailwind max-width class for the panel. */
  widthClass?: string;
};

/** Modal with focus trap, Escape to close, focus restore, and scroll lock. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = DIALOG_PLACEMENT.CENTER,
  widthClass = 'max-w-lg',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>('[data-autofocus]');
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? firstFocusable ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const isDrawer = placement === DIALOG_PLACEMENT.RIGHT;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-foreground/40',
        isDrawer ? 'justify-end' : 'items-center justify-center p-4',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full flex-col bg-card shadow-overlay outline-none',
          widthClass,
          isDrawer ? 'h-full' : 'max-h-full rounded-2xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="닫기" onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
