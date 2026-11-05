import { Button, ButtonSpinner, ButtonText } from '@theolive/ui/components/button';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  isDisabled?: boolean;
  isLoading?: boolean;
  accessibilityHint?: string;
};

const VARIANT_CLASS = {
  primary: '',
  secondary: 'bg-secondary',
  outline: 'border-[1.5px] border-primary bg-transparent',
} as const;

const TEXT_CLASS = {
  primary: 'text-base font-bold',
  secondary: 'text-base font-bold text-secondary-foreground',
  outline: 'text-base font-bold text-primary',
} as const;

/** DESIGN.md buttons: pill shape, 52px primary / 44px secondary heights. */
export function CtaButton({
  label,
  onPress,
  variant = 'primary',
  isDisabled = false,
  isLoading = false,
  accessibilityHint,
}: Props) {
  const heightClass = variant === 'primary' ? 'min-h-13' : 'min-h-11';
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
