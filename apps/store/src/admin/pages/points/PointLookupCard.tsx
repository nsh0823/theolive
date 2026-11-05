import { useState } from 'react';
import { Search } from 'lucide-react';
import { findPointCode } from '@/domain/pointCodes';
import { POINT_CODE_STATUS_LABEL } from '@/domain/labels';
import type { PointCode } from '@/domain/models';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { TextField } from '@/ui/Fields';
import { formatDate, formatDateTime, formatWon } from '@/lib/format';

type Lookup = { state: 'idle' } | { state: 'found'; code: PointCode } | { state: 'missing' };

export function PointLookupCard({ codes }: { codes: PointCode[] }) {
  const [input, setInput] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });

  function search(): void {
    const found = findPointCode(codes, input);
    setLookup(found ? { state: 'found', code: found } : { state: 'missing' });
  }

  return (
    <Card>
      <CardHeader icon={<Search className="size-5" />} title="코드 조회" />
      <CardBody>
        <form
          className="flex items-end gap-2"
          role="search"
          aria-label="쿠폰 포인트 코드 조회"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <TextField
            label="쿠폰 코드"
            placeholder="OLIVE-XXXX-XXXX"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            wrapperClassName="flex-1"
          />
          <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
            조회
          </Button>
        </form>
        <div aria-live="polite" className="mt-4">
          {lookup.state === 'missing' ? (
            <p className="rounded-xl bg-cream px-4 py-3 text-sm">
              일치하는 코드가 없어요. 코드를 다시 확인해 주세요.
            </p>
          ) : null}
          {lookup.state === 'found' ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-cream px-4 py-3 text-sm">
              <dt className="text-muted-foreground">코드</dt>
              <dd className="font-mono font-semibold">{lookup.code.code}</dd>
              <dt className="text-muted-foreground">상태</dt>
              <dd>
                <Badge tone={BADGE_TONE.NEUTRAL}>
                  {POINT_CODE_STATUS_LABEL[lookup.code.status]}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">포인트 금액</dt>
              <dd className="tabular-nums">{formatWon(lookup.code.amount)}</dd>
              <dt className="text-muted-foreground">남은 포인트</dt>
              <dd className="font-bold tabular-nums">{formatWon(lookup.code.remaining)}</dd>
              <dt className="text-muted-foreground">등록일</dt>
              <dd>
                {lookup.code.registeredAt
                  ? formatDateTime(lookup.code.registeredAt)
                  : '아직 등록 전'}
              </dd>
              <dt className="text-muted-foreground">만료일</dt>
              <dd>{formatDate(lookup.code.expiresAt)}</dd>
            </dl>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
