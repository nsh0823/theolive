import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '@/admin/AdminLayout';
import { DashboardPage } from '@/admin/pages/DashboardPage';
import { MenuPage } from '@/admin/pages/menu/MenuPage';
import { OrderHistoryPage } from '@/admin/pages/orders/OrderHistoryPage';
import { MembersPage } from '@/admin/pages/members/MembersPage';
import { MemberDetailPage } from '@/admin/pages/members/MemberDetailPage';
import { RewardsPage } from '@/admin/pages/rewards/RewardsPage';
import { PointsPage } from '@/admin/pages/points/PointsPage';
import { NoticesPage } from '@/admin/pages/NoticesPage';
import { StaffPage } from '@/admin/pages/StaffPage';
import { SettingsPage } from '@/admin/pages/settings/SettingsPage';
import { OrdersPage } from '@/orders/OrdersPage';
import { ROUTES } from '@/lib/routes';
import { ToastProvider } from '@/ui/Toast';

/** One app, two surfaces (PRD 11.1): Store Web at /orders and Store Admin at /admin. */
export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.ORDERS} replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="orders" element={<OrderHistoryPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:memberId" element={<MemberDetailPage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="points" element={<PointsPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.ORDERS} replace />} />
      </Routes>
    </ToastProvider>
  );
}
