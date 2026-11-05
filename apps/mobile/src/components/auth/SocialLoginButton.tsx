import { SOCIAL_PROVIDER } from '@theolive/api';
import { Button, ButtonText } from '@theolive/ui/components/button';

// Launch providers (approved 2026-11-05). Naver is added later, it is not a built-in Supabase provider (OQ-1).
export const SOCIAL_PROVIDERS = [
  { id: SOCIAL_PROVIDER.KAKAO, label: '카카오로 계속하기' },
  { id: SOCIAL_PROVIDER.GOOGLE, label: 'Google로 계속하기' },
  { id: SOCIAL_PROVIDER.APPLE, label: 'Apple로 계속하기' },
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
