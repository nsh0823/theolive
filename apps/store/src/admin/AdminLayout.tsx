import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ADMIN_NAV } from './nav';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';
import { Sidebar } from './Sidebar';

const EXPANDED_SIDEBAR_QUERY = '(min-width: 1280px)';

function defaultCollapsed(): boolean {
  return typeof window.matchMedia === 'function'
    ? !window.matchMedia(EXPANDED_SIDEBAR_QUERY).matches
    : false;
}

/**
 * Store Admin shell: sidebar on the #EFF4F8 canvas, large white rounded content panel (layout reference).
 * Collapses to an icon rail below 1280px; the toggle works at any width.
 */
export function AdminLayout() {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { pathname } = useLocation();
  const current = ADMIN_NAV.find((item) =>
    item.end ? pathname === item.path : pathname.startsWith(item.path),
  );

  return (
    <div className="flex min-h-dvh gap-3 bg-background p-3">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((previous) => !previous)} />
      <div className="flex min-w-0 flex-1 flex-col rounded-3xl bg-card shadow-card">
        <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10 lg:pt-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{current?.label ?? '관리자'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{current?.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <ProfileMenu isCompact />
          </div>
        </header>
        <main className="flex-1 px-6 pb-10 pt-4 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
