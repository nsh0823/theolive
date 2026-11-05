import { useBusinessHours, useStoreSettings } from '@theolive/api';
import { useSupabase } from '@/auth/AuthContext';
import { QUERY_STATUS, toBoundaryStatus } from '@/data/queryStatus';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { HoursCard } from './HoursCard';
import { NotificationCard } from './NotificationCard';
import { OperationCard } from './OperationCard';
import { StoreInfoCard } from './StoreInfoCard';

export function SettingsPage() {
  const client = useSupabase();
  const settings = useStoreSettings(client);
  const hours = useBusinessHours(client);
  const status =
    [toBoundaryStatus(settings.status), toBoundaryStatus(hours.status)].find(
      (s) => s !== QUERY_STATUS.SUCCESS,
    ) ?? QUERY_STATUS.SUCCESS;
  const retry = () => {
    void settings.refetch();
    void hours.refetch();
  };

  return (
    <QueryBoundary
      status={status}
      isEmpty={false}
      onRetry={retry}
      emptyTitle=""
      loadingLabel="매장 설정을 불러오는 중이에요"
    >
      {settings.data && hours.data ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <StoreInfoCard info={settings.data.info} />
          <OperationCard status={settings.data.status} />
          <HoursCard hours={hours.data} />
          <NotificationCard settings={settings.data.notifications} />
        </div>
      ) : null}
    </QueryBoundary>
  );
}
