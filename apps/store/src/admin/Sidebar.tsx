import { NavLink } from 'react-router';
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/ui/Logo';
import { IconButton } from '@/ui/Button';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { ADMIN_NAV, NAV_SECTION } from './nav';
import { ProfileMenu } from './ProfileMenu';

type SidebarProps = { isCollapsed: boolean; onToggle: () => void };

/** Light sidebar on the canvas: logo, outline-icon nav, gray active pill, section labels, profile at the bottom. */
export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const sections = Object.values(NAV_SECTION);
  return (
    <aside
      className={cn(
        'sticky top-3 flex h-[calc(100dvh-1.5rem)] shrink-0 flex-col transition-[width]',
        isCollapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center px-2 pb-4 pt-2',
          isCollapsed ? 'flex-col gap-3' : 'justify-between',
        )}
      >
        <Logo size={isCollapsed ? 'COMPACT' : 'REGULAR'} />
        <IconButton
          label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={onToggle}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-5" aria-hidden="true" />
          )}
        </IconButton>
      </div>

      <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            {isCollapsed ? (
              <hr className="mx-3 mb-2 border-border" />
            ) : (
              <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-widest text-muted-foreground">
                {section}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {ADMIN_NAV.filter((item) => item.section === section).map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm',
                        isCollapsed && 'justify-center',
                        isActive
                          ? 'bg-secondary font-semibold text-secondary-foreground'
                          : 'text-foreground hover:bg-card/70',
                      )
                    }
                  >
                    <item.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {isCollapsed ? null : item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <NavLink
          to={ROUTES.ORDERS}
          title={isCollapsed ? '주문 화면 열기' : undefined}
          aria-label={isCollapsed ? '주문 화면 열기' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-card/70',
            isCollapsed && 'justify-center',
          )}
        >
          <ExternalLink className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {isCollapsed ? null : '주문 화면 열기'}
        </NavLink>
      </nav>

      <div className="border-t border-border pt-3">
        <ProfileMenu isCompact={isCollapsed} align="left" />
      </div>
    </aside>
  );
}
