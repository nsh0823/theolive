import { useState } from 'react';
import { Link } from 'react-router';
import { useMembersQuery, useOrdersQuery } from '@/data/queries';
import { QUERY_STATUS } from '@/data/useFixtureQuery';
import { LOGIN_PROVIDER_LABEL } from '@/domain/labels';
import {
  EMPTY_MEMBER_FILTERS,
  computeMemberStats,
  filterMembers,
  hasActiveMemberFilters,
  ordersOfMember,
} from '@/domain/members';
import { Badge } from '@/ui/Badge';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatCount, formatDate, formatWon } from '@/lib/format';
import { memberDetailPath } from '@/lib/routes';
import { MemberFiltersBar } from './MemberFiltersBar';
import { ViewOnlyNote } from './ViewOnlyNote';

/** 회원관리 list. View only: there is deliberately no button here that changes a member. */
export function MembersPage() {
  const members = useMembersQuery();
  const orders = useOrdersQuery();
  const [filters, setFilters] = useState(EMPTY_MEMBER_FILTERS);

  const status = members.status === QUERY_STATUS.SUCCESS ? orders.status : members.status;
  const results = filterMembers(members.data, orders.data, filters);
  const isFiltered = hasActiveMemberFilters(filters);
  const retry = () => {
    members.refetch();
    orders.refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      <ViewOnlyNote />
      <Card>
        <CardBody>
          <MemberFiltersBar filters={filters} onChange={setFilters} />
        </CardBody>
      </Card>
      <Card>
        <QueryBoundary
          status={status}
          isEmpty={results.length === 0}
          onRetry={retry}
          emptyTitle={isFiltered ? '조건에 맞는 회원이 없어요' : '아직 가입한 회원이 없어요'}
          emptyDescription={isFiltered ? '검색어나 필터를 바꿔 보세요.' : undefined}
          emptyAction={
            isFiltered ? (
              <Button
                variant={BUTTON_VARIANT.OUTLINE}
                onClick={() => setFilters(EMPTY_MEMBER_FILTERS)}
              >
                필터 초기화
              </Button>
            ) : undefined
          }
          loadingLabel="회원 목록을 불러오는 중이에요"
        >
          <p
            className="border-b border-border px-5 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            총 {results.length}명
          </p>
          <DataTable caption="회원 목록 (개인정보 마스킹)">
            <thead>
              <tr>
                <Th>닉네임</Th>
                <Th>연락처 (마스킹)</Th>
                <Th>가입 경로</Th>
                <Th>가입일</Th>
                <Th>최근 주문</Th>
                <Th className="text-right">주문 수</Th>
                <Th className="text-right">누적 결제</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((member) => {
                const stats = computeMemberStats(ordersOfMember(orders.data, member.id));
                return (
                  <Tr key={member.id}>
                    <Td>
                      <Link
                        to={memberDetailPath(member.id)}
                        className="inline-flex min-h-11 items-center rounded-lg px-2 font-bold text-primary underline-offset-4 hover:underline"
                      >
                        {member.nickname}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">
                      <p>{member.maskedEmail ?? '-'}</p>
                      <p className="tabular-nums">{member.maskedPhone ?? '-'}</p>
                    </Td>
                    <Td>
                      <Badge>{LOGIN_PROVIDER_LABEL[member.provider]}</Badge>
                    </Td>
                    <Td className="tabular-nums">{formatDate(member.joinedAt)}</Td>
                    <Td className="tabular-nums">
                      {stats.lastOrderAt ? formatDate(stats.lastOrderAt) : '주문 없음'}
                    </Td>
                    <Td className="text-right tabular-nums">{formatCount(stats.orderCount)}건</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {formatWon(stats.totalSpent)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        </QueryBoundary>
      </Card>
    </div>
  );
}
