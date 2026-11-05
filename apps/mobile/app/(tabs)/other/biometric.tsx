import { Text } from '@theolive/ui/components/text';

import { SettingSwitchRow } from '@/components/other/SettingSwitchRow';
import { BiometricUnavailable } from '@/components/other/BiometricUnavailable';
import { ListGroup } from '@/components/ui/ListGroup';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useBiometricStatusQuery } from '@/fixtures/queries';
import { BIOMETRIC_STATUS } from '@/models';
import { useAppLockStore } from '@/store/useAppLockStore';

/** AUTH-05 (P1): Face ID / fingerprint depends on device capability; availability is stubbed. */
export default function BiometricScreen() {
  const state = useBiometricStatusQuery();
  const { lockEnabled, biometricEnabled, setBiometricEnabled } = useAppLockStore();
  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {(status) =>
          status === BIOMETRIC_STATUS.AVAILABLE ? (
            <>
              <ListGroup>
                <SettingSwitchRow
                  label="Face ID / 지문으로 잠금 해제"
                  description={lockEnabled ? undefined : '앱 비밀번호 잠금을 먼저 켜 주세요'}
                  value={biometricEnabled && lockEnabled}
                  onValueChange={setBiometricEnabled}
                  disabled={!lockEnabled}
                />
              </ListGroup>
              <Text size="sm" className="text-muted-foreground">
                생체 인증이 실패하면 앱 비밀번호로 잠금을 해제할 수 있어요.
              </Text>
            </>
          ) : (
            <BiometricUnavailable status={status} />
          )
        }
      </QueryBoundary>
    </Screen>
  );
}
