import { RefreshCw } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { AUTH_ROUTES, ROUTES } from '@/lib/routes';
import { Button, BUTTON_VARIANT, buttonClasses } from '@/ui/Button';
import { AuthShell } from './AuthShell';
import { ACCESS_RULE, ROUTE_DECISION, decideRoute, type AccessRule } from './accessRules';
import { useAuth } from './AuthContext';

/** Gates a route group. Server-side RLS and RPC checks remain the real boundary. */
export function RequireAccess({ rule }: { rule: AccessRule }) {
  const { state, signOut, retry } = useAuth();
  const location = useLocation();

  switch (decideRoute(state, rule)) {
    case ROUTE_DECISION.WAIT:
      return (
        <AuthShell title="확인하는 중이에요">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            계정 권한을 확인하고 있어요
          </p>
        </AuthShell>
      );
    case ROUTE_DECISION.LOGIN:
      return (
        <Navigate
          to={AUTH_ROUTES.LOGIN}
          replace
          state={{ from: `${location.pathname}${location.search}` }}
        />
      );
    case ROUTE_DECISION.ERROR:
      return (
        <AuthShell title="권한을 확인하지 못했어요">
          <p role="alert" className="text-sm text-muted-foreground">
            네트워크 상태를 확인하고 다시 시도해 주세요.
          </p>
          <Button onClick={retry}>다시 시도</Button>
        </AuthShell>
      );
    case ROUTE_DECISION.DENY:
      return (
        <AuthShell title="접근 권한이 없어요">
          <p role="alert" className="text-sm text-muted-foreground">
            이 화면을 볼 수 있는 권한이 없는 계정이에요. 점주에게 권한을 요청해 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {rule === ACCESS_RULE.ADMIN ? (
              <Link to={ROUTES.ORDERS} className={buttonClasses()}>
                주문 화면으로
              </Link>
            ) : null}
            <Button variant={BUTTON_VARIANT.OUTLINE} onClick={() => void signOut()}>
              로그아웃
            </Button>
          </div>
        </AuthShell>
      );
    case ROUTE_DECISION.ALLOW:
      return <Outlet />;
  }
}
