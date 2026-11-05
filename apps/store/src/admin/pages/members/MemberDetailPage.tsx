import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { AppError, useMember } from '@theolive/api';
import { APP_ERROR } from '@theolive/types';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { buttonClasses, BUTTON_VARIANT } from '@/ui/Button';
import { ROUTES } from '@/lib/routes';
import { MemberOrdersCard } from './MemberOrdersCard';
import { MemberPointSection } from './MemberPointSection';
import { MemberProfileCard } from './MemberProfileCard';
import { MemberStampSection } from './MemberStampSection';
import { ViewOnlyNote } from './ViewOnlyNote';

function isNotFound(error: unknown): boolean {
  return error instanceof AppError && error.code === APP_ERROR.NOT_FOUND;
}

/** /admin/members/:memberId. Stamps and points are separate sections with separate data; nothing mutates. */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const query = useMember(useSupabase(), memberId);
  const member = query.data ?? null;
  // An unknown member is an answer, not a failure: show the "not found" state instead of a retry.
  const missing = query.isError && isNotFound(query.error);

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
        status={missing ? 'success' : toBoundaryStatus(query.status)}
        isEmpty={member === null}
        onRetry={() => void query.refetch()}
        emptyTitle="회원을 찾을 수 없어요"
        emptyDescription="목록으로 돌아가 다시 선택해 주세요."
        loadingLabel="회원 정보를 불러오는 중이에요"
      >
        {member ? (
          <>
            <div className="grid gap-5 2xl:grid-cols-2">
              <MemberProfileCard member={member} />
              <MemberOrdersCard orders={member.orders} />
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
              <MemberStampSection balance={member.stampBalance} entries={member.stampLedger} />
              <MemberPointSection balance={member.pointBalance} entries={member.pointLedger} />
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
