import { Button, ButtonSpinner, ButtonText } from '@theolive/ui/components/button';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  isDisabled?: boolean;
  isLoading?: boolean;
  accessibilityHint?: string;
};

const VARIANT_CLASS = {
  primary: '',
  secondary: 'bg-secondary',
  outline: 'border-[1.5px] border-primary bg-transparent',
  destructive: 'bg-destructive',
} as const;

const TEXT_CLASS = {
  primary: 'text-base font-bold',
  secondary: 'text-base font-bold text-secondary-foreground',
  outline: 'text-base font-bold text-primary',
  destructive: 'text-base font-bold text-white',
} as const;

/** DESIGN.md buttons: pill shape, 52px primary / 48px secondary heights (touch targets >= 44pt). */
export function CtaButton({
  label,
  onPress,
  variant = 'primary',
  isDisabled = false,
  isLoading = false,
  accessibilityHint,
}: Props) {
  const heightClass = variant === 'primary' || variant === 'destructive' ? 'min-h-13' : 'min-h-12';
  return (
    <Button
      variant="default"
      className={`${heightClass} rounded-full ${VARIANT_CLASS[variant]}`}
      onPress={onPress}
      isDisabled={isDisabled || isLoading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {isLoading ? <ButtonSpinner /> : null}
      <ButtonText className={TEXT_CLASS[variant]}>{label}</ButtonText>
    </Button>
  );
}
