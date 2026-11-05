import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MEMBER_SEEDS } from '@/data/fixtures/members';
import { renderWithProviders } from '@/test/render';
import { MemberDetailPage } from './MemberDetailPage';
import { MembersPage } from './MembersPage';

function renderDetail(memberId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/members/:memberId" element={<MemberDetailPage />} />
    </Routes>,
    `/admin/members/${memberId}`,
  );
}

function expectNoRawPii(container: HTMLElement): void {
  const text = container.textContent ?? '';
  const html = container.innerHTML;
  for (const seed of MEMBER_SEEDS) {
    for (const raw of [seed.email, seed.phone]) {
      if (raw === null) continue;
      expect(text).not.toContain(raw);
      expect(html).not.toContain(raw);
    }
  }
}

describe('MembersPage', () => {
  it('lists members with masked contact, notes view-only, and shows no raw email or phone', async () => {
    const { container } = renderWithProviders(<MembersPage />);
    const table = await screen.findByRole('table', { name: /회원 목록/ });
    expect(screen.getByRole('note')).toHaveTextContent(
      '보기 전용 · 개인정보는 마스킹되어 표시됩니다',
    );
    expect(screen.getByRole('note')).toHaveTextContent('보안 경계가 아니에요');
    expect(within(table).getByText('jiho***@gmail.com')).toBeInTheDocument();
    expect(within(table).getByText('010-****-6781')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(26);
    expectNoRawPii(container);
  });

  it('has no control that mutates a member', async () => {
    renderWithProviders(<MembersPage />);
    await screen.findByRole('table', { name: /회원 목록/ });
    expect(
      screen.queryByRole('button', { name: /정지|해제|수정|삭제|조정|추가/ }),
    ).not.toBeInTheDocument();
  });

  it('searches by order number and filters by provider', async () => {
    renderWithProviders(<MembersPage />);
    const table = await screen.findByRole('table', { name: /회원 목록/ });
    await userEvent.type(screen.getByLabelText('검색'), 'A-41');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('올리브러버')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('검색'));
    await userEvent.selectOptions(screen.getByLabelText('가입 경로'), 'APPLE');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('shows an empty state with a reset action when nothing matches', async () => {
    renderWithProviders(<MembersPage />);
    await screen.findByRole('table', { name: /회원 목록/ });
    await userEvent.type(screen.getByLabelText('검색'), '없는닉네임');
    expect(screen.getByText('조건에 맞는 회원이 없어요')).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole('button', { name: '필터 초기화' })[0] ?? document.body,
    );
    expect(await screen.findByRole('table', { name: /회원 목록/ })).toBeInTheDocument();
  });
});

describe('MemberDetailPage', () => {
  it('keeps Olive Stamps and Coupon Points in separate sections with their own balance and ledger', async () => {
    const { container } = renderDetail('m03');
    const stamps = await screen.findByRole('region', { name: '올리브 스탬프' });
    const points = screen.getByRole('region', { name: '쿠폰 포인트' });
    expect(stamps).not.toContainElement(points);
    expect(points).not.toContainElement(stamps);

    expect(within(stamps).getByText('15개')).toBeInTheDocument();
    expect(within(stamps).getByRole('table', { name: '스탬프 원장' })).toBeInTheDocument();
    expect(within(stamps).queryByText(/포인트 코드 등록|원$/)).not.toBeInTheDocument();
    expect(within(stamps).queryByRole('table', { name: '포인트 원장' })).not.toBeInTheDocument();

    expect(within(points).getByText('9,000원')).toBeInTheDocument();
    expect(within(points).getByRole('table', { name: '포인트 원장' })).toBeInTheDocument();
    expect(within(points).queryByText(/쿠폰 교환|주문 적립/)).not.toBeInTheDocument();
    expect(within(points).queryByRole('table', { name: '스탬프 원장' })).not.toBeInTheDocument();

    expect(screen.queryByText(/통합|합계 리워드/)).not.toBeInTheDocument();
    expectNoRawPii(container);
  });

  it('shows masked profile, recent orders linking to order detail, and handles a member without orders', async () => {
    renderDetail('m01');
    expect(await screen.findByText('jiho***@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('010-****-6781')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '주문 A-41 상세 보기' });
    expect(link).toHaveAttribute('href', '/admin/orders?order=order-A-41');
  });

  it('renders a member with no orders, stamps or points', async () => {
    renderDetail('m22');
    expect(await screen.findByText('아직 주문 내역이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('스탬프 내역이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('포인트 내역이 없어요.')).toBeInTheDocument();
  });

  it('says so for an unknown member id', async () => {
    renderDetail('nope');
    expect(await screen.findByText('회원을 찾을 수 없어요')).toBeInTheDocument();
  });
});
