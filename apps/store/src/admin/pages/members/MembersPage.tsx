import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MEMBER_PAGE_SIZE, useMembers } from '@theolive/api';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { loginProviderLabel } from '@/domain/labels';
import { Badge } from '@/ui/Badge';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatCount, formatDate, formatWon } from '@/lib/format';
import { memberDetailPath } from '@/lib/routes';
import { MS_PER_SECOND } from '@/lib/time';
import { MemberFiltersBar } from './MemberFiltersBar';
import { ViewOnlyNote } from './ViewOnlyNote';

const SEARCH_DEBOUNCE_MS = MS_PER_SECOND / 3;

/** 회원관리 list. View only. Search and paging happen on the server, which also masks email and phone. */
export function MembersPage() {
  const client = useSupabase();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(input.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const query = useMembers(client, { search, limit: MEMBER_PAGE_SIZE, offset });
  const members = query.data?.members ?? [];
  const total = query.data?.total ?? 0;
  const isFiltered = search !== '';
  const pageEnd = Math.min(offset + members.length, total);

  return (
    <div className="flex flex-col gap-5">
      <ViewOnlyNote />
      <Card>
        <CardBody>
          <MemberFiltersBar value={input} onChange={setInput} />
        </CardBody>
      </Card>
      <Card>
        <QueryBoundary
          status={toBoundaryStatus(query.status)}
          isEmpty={members.length === 0}
          onRetry={() => void query.refetch()}
          emptyTitle={isFiltered ? '조건에 맞는 회원이 없어요' : '아직 가입한 회원이 없어요'}
          emptyDescription={isFiltered ? '닉네임이나 주문번호를 다시 확인해 보세요.' : undefined}
          loadingLabel="회원 목록을 불러오는 중이에요"
        >
          <p
            className="border-b border-border px-5 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            총 {formatCount(total)}명 · {offset + 1}-{pageEnd}번째
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
              {members.map((member) => (
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
                    <Badge>{loginProviderLabel(member.provider)}</Badge>
                  </Td>
                  <Td className="tabular-nums">{formatDate(member.joinedAt)}</Td>
                  <Td className="tabular-nums">
                    {member.lastOrderAt ? formatDate(member.lastOrderAt) : '주문 없음'}
                  </Td>
                  <Td className="text-right tabular-nums">{formatCount(member.orderCount)}건</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">
                    {formatWon(member.totalSpent)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button
              variant={BUTTON_VARIANT.OUTLINE}
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - MEMBER_PAGE_SIZE))}
            >
              이전
            </Button>
            <Button
              variant={BUTTON_VARIANT.OUTLINE}
              disabled={offset + MEMBER_PAGE_SIZE >= total}
              onClick={() => setOffset(offset + MEMBER_PAGE_SIZE)}
            >
              다음
            </Button>
          </div>
        </QueryBoundary>
      </Card>
    </div>
  );
}
