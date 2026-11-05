import { Coffee, CupSoda, Cookie, Leaf, Milk, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// No product photography exists yet; same cream placeholder tile as the customer app (DESIGN.md).
const CATEGORY_ICON: Record<string, LucideIcon> = {
  coffee: Coffee,
  latte: Milk,
  'non-coffee': CupSoda,
  tea: Leaf,
  dessert: Cookie,
};

export function Thumbnail({ categoryId, className }: { categoryId: string; className?: string }) {
  const Icon = CATEGORY_ICON[categoryId] ?? Coffee;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-cream text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-6" />
    </span>
  );
}
