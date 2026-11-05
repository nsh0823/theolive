import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Fingerprint } from 'lucide-react-native';

import { BIOMETRIC_STATUS, type BiometricStatus } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';

const UNAVAILABLE_MESSAGE: Record<Exclude<BiometricStatus, 'AVAILABLE'>, string> = {
  [BIOMETRIC_STATUS.NOT_ENROLLED]:
    '기기에 등록된 Face ID나 지문이 없어요. 기기 설정에서 등록한 뒤 다시 확인해 주세요.',
  [BIOMETRIC_STATUS.UNSUPPORTED]:
    '이 기기는 생체 인증을 지원하지 않아요. 앱 비밀번호 잠금을 대신 사용해 주세요.',
};

/** Unavailable state: unsupported device or no enrolled Face ID / fingerprint. */
export function BiometricUnavailable({
  status,
}: {
  status: Exclude<BiometricStatus, 'AVAILABLE'>;
}) {
  return (
    <Card className="items-center gap-3 py-8" accessibilityRole="alert">
      <AppIcon icon={Fingerprint} tone="muted" size={40} />
      <Heading size="sm">생체 인증을 사용할 수 없어요</Heading>
      <Text className="text-center text-muted-foreground">{UNAVAILABLE_MESSAGE[status]}</Text>
    </Card>
  );
}
