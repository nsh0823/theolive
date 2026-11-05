import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MS_PER_SECOND } from '@/lib/time';

const TOAST_DURATION_MS = 4 * MS_PER_SECOND;

type ToastContextValue = { notify: (message: string) => void };
const ToastContext = createContext<ToastContextValue>({ notify: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

type ToastItem = { id: number; message: string };

/** Action feedback in an aria-live region (PRD 5.7: status changes give clear feedback). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setItems((previous) => [...previous, { id, message }]);
    window.setTimeout(
      () => setItems((previous) => previous.filter((item) => item.id !== id)),
      TOAST_DURATION_MS,
    );
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <p
            key={item.id}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-overlay"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {item.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
