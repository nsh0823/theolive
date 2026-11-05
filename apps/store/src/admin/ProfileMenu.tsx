import { Link } from 'react-router';
import { ChevronsUpDown, LogOut, Tablet } from 'lucide-react';
import { PopoverMenu } from '@/ui/PopoverMenu';
import { ROUTES } from '@/lib/routes';
import { useSignedInUser, useAuth } from '@/auth/AuthContext';

const ROLE_LABEL = '점주';

type ProfileMenuProps = { isCompact?: boolean; align?: 'left' | 'right' };

export function ProfileMenu({ isCompact = false, align = 'right' }: ProfileMenuProps) {
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const profile = { name: user.displayName, role: ROLE_LABEL };
  return (
    <PopoverMenu
      label={`관리자 프로필 메뉴: ${profile.name}`}
      align={align}
      triggerClassName="w-full px-2 py-1.5"
      trigger={
        <>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground"
            aria-hidden="true"
          >
            {profile.name.slice(0, 1)}
          </span>
          {isCompact ? null : (
            <>
              <span className="min-w-0 flex-1 text-left text-sm font-semibold">
                {profile.name}
                <span className="block text-xs font-normal text-muted-foreground">
                  {profile.role}
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
          {profile.name} ({profile.role})
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Link
        to={ROUTES.ORDERS}
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm hover:bg-background"
      >
        <Tablet className="size-4" aria-hidden="true" /> 주문 화면(Store Web)으로 이동
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-background"
      >
        <LogOut className="size-4" aria-hidden="true" /> 로그아웃
      </button>
    </PopoverMenu>
  );
}
