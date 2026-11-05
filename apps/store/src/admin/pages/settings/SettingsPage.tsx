import { useHoursQuery, useNotificationSettingsQuery, useStoreInfoQuery } from '@/data/queries';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { HoursCard } from './HoursCard';
import { NotificationCard } from './NotificationCard';
import { OperationCard } from './OperationCard';
import { StoreInfoCard } from './StoreInfoCard';

export function SettingsPage() {
  const info = useStoreInfoQuery();
  const hours = useHoursQuery();
  const notifications = useNotificationSettingsQuery();
  const status =
    [info.status, hours.status, notifications.status].find((s) => s !== 'success') ?? 'success';
  const retry = () => {
    info.refetch();
    hours.refetch();
    notifications.refetch();
  };

  return (
    <QueryBoundary
      status={status}
      isEmpty={false}
      onRetry={retry}
      emptyTitle=""
      loadingLabel="매장 설정을 불러오는 중이에요"
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <StoreInfoCard info={info.data} />
        <OperationCard />
        <HoursCard hours={hours.data} />
        <NotificationCard settings={notifications.data} />
      </div>
    </QueryBoundary>
  );
}
