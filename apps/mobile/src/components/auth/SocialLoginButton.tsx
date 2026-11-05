import { Button, ButtonText } from '@theolive/ui/components/button';

export const SOCIAL_PROVIDERS = [
  { id: 'kakao', label: '카카오로 계속하기' },
  { id: 'naver', label: '네이버로 계속하기' },
  { id: 'google', label: 'Google로 계속하기' },
  { id: 'apple', label: 'Apple로 계속하기' },
] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]['id'];

type Props = { label: string; onPress: () => void; isDisabled?: boolean };

/**
 * Provider brand colors/logos are intentionally not reproduced here; each provider's own
 * button guidelines must be applied when OAuth is wired (AUTH-01).
 */
export function SocialLoginButton({ label, onPress, isDisabled = false }: Props) {
  return (
    <Button
      variant="outline"
      className="min-h-13 rounded-full border-border bg-card"
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityLabel={label}
    >
      <ButtonText className="text-base font-semibold">{label}</ButtonText>
    </Button>
  );
}
