import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PopoverMenuProps = {
  /** Accessible name of the trigger button. */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  triggerClassName?: string;
};

/** Small dropdown panel: closes on Escape (focus returns to trigger) and on outside click. */
export function PopoverMenu({
  label,
  trigger,
  children,
  align = 'right',
  triggerClassName,
}: PopoverMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(event: MouseEvent): void {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-full hover:bg-background',
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={panelId}
          className={cn(
            'absolute top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-popover p-2 shadow-overlay',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
