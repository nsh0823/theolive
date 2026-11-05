import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';

import { SettingSwitchRow } from '@/components/other/SettingSwitchRow';
import { Card } from '@/components/ui/Card';
import { ListGroup } from '@/components/ui/ListGroup';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '@/hooks/useNotifications';
import type { NotificationPreferences } from '@/models';

const SAVE_FAILED_MESSAGE = '설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';

/** OTH-05: shows the change at once and puts the switch back if the server refuses it. */
function Preferences({ initial }: { initial: NotificationPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [failed, setFailed] = useState(false);
  const update = useUpdateNotificationPreferencesMutation();

  const change = (next: NotificationPreferences) => {
    const previous = prefs;
    setPrefs(next);
    setFailed(false);
    update.mutate(next, {
      onError: () => {
        setPrefs(previous);
        setFailed(true);
      },
    });
  };

  return (
    <>
      <ListGroup>
        <SettingSwitchRow
          label="주문 상태 알림"
          description="접수, 제조 완료, 결제, 스탬프, 쿠폰, 포인트 알림"
          value={prefs.orderUpdates}
          onValueChange={(orderUpdates) => change({ ...prefs, orderUpdates })}
        />
        <SettingSwitchRow
          label="공지사항 알림"
          value={prefs.notices}
          onValueChange={(notices) => change({ ...prefs, notices })}
        />
      </ListGroup>
      {failed ? (
        <Card className="bg-secondary" accessibilityLiveRegion="polite">
          <Text className="text-secondary-foreground">{SAVE_FAILED_MESSAGE}</Text>
        </Card>
      ) : null}
    </>
  );
}

export default function NotificationSettingsScreen() {
  const state = useNotificationPreferencesQuery();
  return (
    <Screen>
      <QueryBoundary state={state} emptyMessage="">
        {(initial) => <Preferences initial={initial} />}
      </QueryBoundary>
    </Screen>
  );
}
