import { Bell } from 'lucide-react';
import { setNotificationSettings } from '@/data/actions';
import type { NotificationSettings } from '@/domain/models';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const OPTIONS: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  {
    key: 'newOrderSound',
    label: '신규 주문 알림음',
    hint: 'Store Web에서 새 주문이 도착하면 소리로 알려요.',
  },
  { key: 'newOrderBanner', label: '신규 주문 화면 알림', hint: '화면에 새 주문 표시를 강조해요.' },
  {
    key: 'soldOutReminder',
    label: '품절 상태 리마인드',
    hint: '마감 전 품절 상태인 메뉴를 알려요.',
  },
  { key: 'dailySummary', label: '일일 매출 요약', hint: '영업 종료 후 하루 요약을 보내요.' },
];

export function NotificationCard({ settings }: { settings: NotificationSettings }) {
  const { notify } = useToast();
  return (
    <Card>
      <CardHeader icon={<Bell className="size-5" />} title="알림 설정" />
      <CardBody className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between rounded-xl border border-border px-4"
          >
            <div className="py-2.5">
              <p className="text-sm font-semibold">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.hint}</p>
            </div>
            <Switch
              checked={settings[option.key]}
              label={option.label}
              onChange={(value) => {
                setNotificationSettings({ ...settings, [option.key]: value });
                notify('알림 설정을 저장했어요');
              }}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
