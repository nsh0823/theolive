import { UserRound } from 'lucide-react';
import { LOGIN_PROVIDER_LABEL } from '@/domain/labels';
import type { Member, MemberStats } from '@/domain/memberModels';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { formatCount, formatDate, formatWon } from '@/lib/format';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function MemberProfileCard({ member, stats }: { member: Member; stats: MemberStats }) {
  return (
    <Card>
      <CardHeader
        icon={<UserRound className="size-5" />}
        title={`${member.nickname} 님 (마스킹된 정보)`}
      />
      <dl className="divide-y divide-border px-5">
        <Row label="이메일" value={member.maskedEmail ?? '-'} />
        <Row label="휴대전화" value={member.maskedPhone ?? '-'} />
        <Row label="가입 경로" value={LOGIN_PROVIDER_LABEL[member.provider]} />
        <Row label="가입일" value={formatDate(member.joinedAt)} />
        <Row
          label="최근 주문일"
          value={stats.lastOrderAt ? formatDate(stats.lastOrderAt) : '주문 없음'}
        />
      </dl>
      <StatRow>
        <StatFigure value={`${formatCount(stats.orderCount)}건`} label="주문 수" />
        <StatFigure value={formatWon(stats.totalSpent)} label="누적 결제" />
      </StatRow>
    </Card>
  );
}
