import { Coffee, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type ThumbnailProps = {
  /** Public URL of the product photo; without one a cream placeholder tile is shown (DESIGN.md). */
  imageUrl: string | null;
  className?: string;
  Icon?: LucideIcon;
};

export function Thumbnail({ imageUrl, className, Icon = Coffee }: ThumbnailProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn('inline-block size-12 shrink-0 rounded-xl bg-cream object-cover', className)}
      />
    );
  }
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
