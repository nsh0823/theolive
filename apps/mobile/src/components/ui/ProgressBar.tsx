import { View } from 'react-native';

type Props = { fraction: number; onDark?: boolean; label: string };

const PERCENT = 100;

/** Always paired with a text value nearby; the bar itself is decorative reinforcement. */
export function ProgressBar({ fraction, onDark = false, label }: Props) {
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * PERCENT);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: PERCENT, now: percent }}
      className={`h-2 overflow-hidden rounded-full ${onDark ? 'bg-primary-foreground/25' : 'bg-secondary'}`}
    >
      <View
        className={`h-full rounded-full ${onDark ? 'bg-primary-foreground' : 'bg-primary'}`}
        style={{ width: `${percent}%` }}
      />
    </View>
  );
}
