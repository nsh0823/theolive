import { useResolveClassNames } from 'uniwind';

// Literal class names so Tailwind's scanner sees them.
export const TONE_CLASS = {
  primary: 'text-primary',
  background: 'text-background',
  card: 'text-card',
  primaryForeground: 'text-primary-foreground',
  foreground: 'text-foreground',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
  secondaryForeground: 'text-secondary-foreground',
} as const;

export type Tone = keyof typeof TONE_CLASS;

/** Resolves a theme token to a color for APIs that cannot take className (icons, native tabs). */
export function useToneColor(tone: Tone) {
  return useResolveClassNames(TONE_CLASS[tone]).color;
}
