import { useState } from 'react';
import { Clock } from 'lucide-react';
import { setHours } from '@/data/actions';
import { findInvalidHours } from '@/domain/hours';
import { WEEKDAY_LABEL } from '@/domain/labels';
import type { BusinessHours } from '@/domain/models';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { useToast } from '@/ui/Toast';

const TIME_INPUT_CLASS =
  'h-11 rounded-xl border border-input bg-card px-2 text-sm tabular-nums disabled:opacity-40';

export function HoursCard({ hours }: { hours: BusinessHours[] }) {
  const [draft, setDraft] = useState(hours);
  const [invalid, setInvalid] = useState<number[]>([]);
  const { notify } = useToast();
  const update = (weekday: number, patch: Partial<BusinessHours>) =>
    setDraft((list) => list.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  function save(): void {
    const bad = findInvalidHours(draft);
    setInvalid(bad);
    if (bad.length > 0) return;
    setHours(draft);
    notify('영업 시간을 저장했어요');
  }

  return (
    <Card>
      <CardHeader icon={<Clock className="size-5" />} title="영업 시간" />
      <CardBody>
        <ul className="flex flex-col gap-2">
          {draft.map((day) => {
            const name = WEEKDAY_LABEL[day.weekday] ?? '';
            return (
              <li key={day.weekday} className="flex flex-wrap items-center gap-3">
                <span className="w-8 text-sm font-semibold">{name}</span>
                <input
                  type="time"
                  aria-label={`${name}요일 오픈 시간`}
                  className={TIME_INPUT_CLASS}
                  value={day.opensAt}
                  disabled={day.isClosed}
                  onChange={(e) => update(day.weekday, { opensAt: e.target.value })}
                />
                <span aria-hidden="true">~</span>
                <input
                  type="time"
                  aria-label={`${name}요일 마감 시간`}
                  className={TIME_INPUT_CLASS}
                  value={day.closesAt}
                  disabled={day.isClosed}
                  onChange={(e) => update(day.weekday, { closesAt: e.target.value })}
                />
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={day.isClosed}
                    onChange={(e) => update(day.weekday, { isClosed: e.target.checked })}
                  />
                  휴무
                </label>
                {invalid.includes(day.weekday) ? (
                  <span role="alert" className="text-xs font-medium text-destructive">
                    마감 시간이 오픈 시간보다 늦어야 해요.
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <Button onClick={save}>저장</Button>
        </div>
      </CardBody>
    </Card>
  );
}
