import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';

import { SettingSwitchRow } from '@/components/other/SettingSwitchRow';
import { ListGroup } from '@/components/ui/ListGroup';
import { Screen } from '@/components/ui/Screen';

/**
 * AUTH-05 (P1) UI only. App lock is a local access guard separate from the server login;
 * wiring to the device biometric API is future work. Switch state is not persisted here.
 */
export default function AppLockScreen() {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  return (
    <Screen>
      <ListGroup>
        <SettingSwitchRow label="앱 잠금" value={lockEnabled} onValueChange={setLockEnabled} />
        <SettingSwitchRow
          label="생체 인증 사용"
          value={biometricEnabled && lockEnabled}
          onValueChange={setBiometricEnabled}
          disabled={!lockEnabled}
        />
      </ListGroup>
      <Text size="sm" className="text-muted-foreground">
        앱 잠금을 켜면 앱을 다시 열 때 기기 인증을 요구해요.
      </Text>
    </Screen>
  );
}
