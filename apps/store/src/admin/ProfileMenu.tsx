import { Link } from 'react-router';
import { ChevronsUpDown, LogOut, ShieldAlert, Tablet } from 'lucide-react';
import { PopoverMenu } from '@/ui/PopoverMenu';
import { ROUTES } from '@/lib/routes';

// Fixture identity. Real identity and role come from the server session (UI role split is not a security boundary).
const ADMIN_PROFILE = { name: '김올리', role: '점주' };

type ProfileMenuProps = { isCompact?: boolean; align?: 'left' | 'right' };

export function ProfileMenu({ isCompact = false, align = 'right' }: ProfileMenuProps) {
  return (
    <PopoverMenu
      label={`관리자 프로필 메뉴: ${ADMIN_PROFILE.name}`}
      align={align}
      triggerClassName="w-full px-2 py-1.5"
      trigger={
        <>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground"
            aria-hidden="true"
          >
            {ADMIN_PROFILE.name.slice(0, 1)}
          </span>
          {isCompact ? null : (
            <>
              <span className="min-w-0 flex-1 text-left text-sm font-semibold">
                {ADMIN_PROFILE.name}
                <span className="block text-xs font-normal text-muted-foreground">
                  {ADMIN_PROFILE.role}
                </span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        </>
      }
    >
      <div className="px-3 py-2">
        <p className="text-sm font-semibold">
          {ADMIN_PROFILE.name} ({ADMIN_PROFILE.role})
        </p>
        <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          역할 표시는 화면용이에요. 실제 권한은 서버에서 검증해요.
        </p>
      </div>
      <Link
        to={ROUTES.ORDERS}
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm hover:bg-background"
      >
        <Tablet className="size-4" aria-hidden="true" /> 주문 화면(Store Web)으로 이동
      </Link>
      <button
        type="button"
        disabled
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground"
      >
        <LogOut className="size-4" aria-hidden="true" /> 로그아웃 (인증 연동 전)
      </button>
    </PopoverMenu>
  );
}
