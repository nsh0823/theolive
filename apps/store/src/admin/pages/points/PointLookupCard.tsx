import { usePointCodes } from '@theolive/api';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { POINT_CODE_STATUS_LABEL } from '@/domain/labels';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { TextField } from '@/ui/Fields';
import { formatDate, formatDateTime, formatWon } from '@/lib/format';

/** One exact code is asked of the server; the full code is never listed back. */
function LookupResult({ search }: { search: string }) {
  const result = usePointCodes(useSupabase(), { status: null, search, limit: 1, offset: 0 });
  if (result.isPending) {
    return <p className="rounded-xl bg-cream px-4 py-3 text-sm">조회하는 중이에요…</p>;
  }
  if (result.isError) {
    return (
      <p role="alert" className="rounded-xl bg-cream px-4 py-3 text-sm">
        조회하지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }
  const code = result.data.codes[0];
  if (!code) {
    return (
      <p className="rounded-xl bg-cream px-4 py-3 text-sm">
        일치하는 코드가 없어요. 코드를 다시 확인해 주세요.
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-cream px-4 py-3 text-sm">
      <dt className="text-muted-foreground">코드</dt>
      <dd className="font-mono font-semibold">{code.maskedCode}</dd>
      <dt className="text-muted-foreground">상태</dt>
      <dd>
        <Badge tone={BADGE_TONE.NEUTRAL}>{POINT_CODE_STATUS_LABEL[code.status]}</Badge>
      </dd>
      <dt className="text-muted-foreground">포인트 금액</dt>
      <dd className="tabular-nums">{formatWon(code.amount)}</dd>
      <dt className="text-muted-foreground">남은 포인트</dt>
      <dd className="font-bold tabular-nums">{formatWon(code.remaining)}</dd>
      <dt className="text-muted-foreground">등록일</dt>
      <dd>{code.registeredAt ? formatDateTime(code.registeredAt) : '아직 등록 전'}</dd>
      <dt className="text-muted-foreground">만료일</dt>
      <dd>{formatDate(code.expiresAt)}</dd>
    </dl>
  );
}

export function PointLookupCard() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
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
            setSearch(input.trim());
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
          {search === '' ? null : <LookupResult key={search} search={search} />}
        </div>
      </CardBody>
    </Card>
  );
}
