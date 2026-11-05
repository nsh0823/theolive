import { cn } from '@/lib/cn';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "품절 처리: 아메리카노". */
  label: string;
  disabled?: boolean;
};

/** Toggle with a 48px-tall hit area. The state is also announced as text by the surrounding row. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-12 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      <span
        className={cn(
          'flex h-7 w-12 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-sage',
        )}
      >
        <span
          className={cn(
            'size-6 rounded-full bg-card shadow-card transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
