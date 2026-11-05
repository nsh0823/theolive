import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AdminLayout } from './AdminLayout';
import { DashboardPage } from './pages/DashboardPage';

function renderAdmin() {
  return renderWithProviders(
    <Routes>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
      </Route>
    </Routes>,
    '/admin',
  );
}

describe('AdminLayout', () => {
  it('lists the eight sidebar items in the brief order and shows the page title', async () => {
    renderAdmin();
    const nav = screen.getByRole('navigation', { name: '관리자 메뉴' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      .filter((text) => text !== '주문 화면 열기');
    expect(labels).toEqual([
      '대시보드',
      '메뉴 관리',
      '주문 내역',
      '회원관리',
      '리워드 관리',
      '쿠폰 포인트 관리',
      '공지사항',
      '직원 관리',
      '매장 설정',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
    expect(await screen.findByText('오늘 매출')).toBeInTheDocument();
  });

  it('collapses to icon-only links that keep accessible names', async () => {
    renderAdmin();
    await userEvent.click(screen.getByRole('button', { name: '사이드바 접기' }));
    expect(screen.getByRole('link', { name: '메뉴 관리' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
