import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  useMembersQuery,
  useOrdersQuery,
  usePointLedgersQuery,
  useStampLedgersQuery,
} from '@/data/queries';
import { QUERY_STATUS, type QueryStatus } from '@/data/useFixtureQuery';
import { computeMemberStats, ordersOfMember } from '@/domain/members';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { buttonClasses, BUTTON_VARIANT } from '@/ui/Button';
import { ROUTES } from '@/lib/routes';
import { MemberOrdersCard } from './MemberOrdersCard';
import { MemberPointSection } from './MemberPointSection';
import { MemberProfileCard } from './MemberProfileCard';
import { MemberStampSection } from './MemberStampSection';
import { ViewOnlyNote } from './ViewOnlyNote';

function firstNotSuccess(statuses: QueryStatus[]): QueryStatus {
  return statuses.find((s) => s !== QUERY_STATUS.SUCCESS) ?? QUERY_STATUS.SUCCESS;
}

/** /admin/members/:memberId. Stamps and points are separate sections with separate data; nothing mutates. */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const members = useMembersQuery();
  const orders = useOrdersQuery();
  const stamps = useStampLedgersQuery();
  const points = usePointLedgersQuery();

  const status = firstNotSuccess([members.status, orders.status, stamps.status, points.status]);
  const member = members.data.find((m) => m.id === memberId) ?? null;
  const retry = () => {
    members.refetch();
    orders.refetch();
    stamps.refetch();
    points.refetch();
  };
  const memberOrders = member ? ordersOfMember(orders.data, member.id) : [];

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={ROUTES.ADMIN_MEMBERS}
        className={`${buttonClasses(BUTTON_VARIANT.OUTLINE)} self-start`}
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> 회원 목록
      </Link>
      <ViewOnlyNote />
      <QueryBoundary
        status={status}
        isEmpty={member === null}
        onRetry={retry}
        emptyTitle="회원을 찾을 수 없어요"
        emptyDescription="목록으로 돌아가 다시 선택해 주세요."
        loadingLabel="회원 정보를 불러오는 중이에요"
      >
        {member ? (
          <>
            <div className="grid gap-5 2xl:grid-cols-2">
              <MemberProfileCard member={member} stats={computeMemberStats(memberOrders)} />
              <MemberOrdersCard orders={memberOrders} />
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
              <MemberStampSection entries={stamps.data[member.id] ?? []} />
              <MemberPointSection entries={points.data[member.id] ?? []} />
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
