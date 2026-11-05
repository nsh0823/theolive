import { useState } from 'react';

import { SettingSwitchRow } from '@/components/other/SettingSwitchRow';
import { ListGroup } from '@/components/ui/ListGroup';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNotificationPreferencesQuery } from '@/fixtures/queries';
import type { NotificationPreferences } from '@/models';

function Preferences({ initial }: { initial: NotificationPreferences }) {
  // Local draft only; saving to the server replaces this with a mutation (OTH-05).
  const [prefs, setPrefs] = useState(initial);
  return (
    <ListGroup>
      <SettingSwitchRow
        label="주문 상태 알림"
        description="접수, 제조 완료 등 주문 진행 알림"
        value={prefs.orderUpdates}
        onValueChange={(orderUpdates) => setPrefs({ ...prefs, orderUpdates })}
      />
      <SettingSwitchRow
        label="공지사항 알림"
        value={prefs.notices}
        onValueChange={(notices) => setPrefs({ ...prefs, notices })}
      />
    </ListGroup>
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
