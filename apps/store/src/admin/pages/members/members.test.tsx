import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError, type MemberDetailView, type MemberView } from '@theolive/api';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { MemberDetailPage } from './MemberDetailPage';
import { MembersPage } from './MembersPage';

const RAW_EMAIL = 'zqxhana@example.test';
const RAW_PHONE = '01012345678';

type Status = 'success' | 'error' | 'pending';
const api = vi.hoisted(() => {
  const list: { status: Status; data: unknown; refetch: () => void } = {
    status: 'success',
    data: undefined,
    refetch: () => undefined,
  };
  const detail: {
    status: Status;
    data: unknown;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  } = { status: 'success', data: undefined, isError: false, error: null, refetch: () => undefined };
  return { list, detail, useMembers: vi.fn() };
});

vi.mock('@theolive/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@theolive/api')>()),
  useMembers: (...args: unknown[]) => {
    api.useMembers(...args);
    return api.list;
  },
  useMember: () => api.detail,
}));

const hana: MemberView = {
  id: 'm1',
  nickname: 'ZQX김하나',
  maskedEmail: 'zqxh***@example.test',
  maskedPhone: '010-****-5678',
  provider: 'KAKAO',
  joinedAt: '2026-11-01T00:00:00Z',
  orderCount: 2,
  totalSpent: 11500,
  lastOrderAt: '2026-11-05T01:00:00Z',
};

const detail: MemberDetailView = {
  ...hana,
  stampBalance: 3,
  pointBalance: 4000,
  stampLedger: [
    {
      id: 1,
      kind: 'EARN',
      label: '주문 적립',
      delta: 1,
      balanceAfter: 3,
      createdAt: '2026-11-04T01:00:00Z',
    },
  ],
  pointLedger: [
    {
      id: 9,
      kind: 'REGISTER',
      label: '코드 등록',
      delta: 4000,
      balanceAfter: 4000,
      createdAt: '2026-11-03T01:00:00Z',
    },
    {
      id: 10,
      kind: 'FORFEIT',
      label: '탈퇴로 소멸',
      delta: -500,
      balanceAfter: 3500,
      createdAt: '2026-11-04T01:00:00Z',
    },
  ],
  orders: [
    {
      id: 'o1',
      orderNumber: 'A-41',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      paidAmount: 6500,
      placedAt: '2026-11-05T01:00:00Z',
    },
  ],
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/members/:memberId" element={<MemberDetailPage />} />
    </Routes>,
    '/admin/members/m1',
  );
}

beforeEach(() => {
  api.useMembers.mockClear();
  api.list.status = 'success';
  api.list.data = { members: [hana], total: 1 };
  api.detail.status = 'success';
  api.detail.isError = false;
  api.detail.error = null;
  api.detail.data = detail;
});

describe('MembersPage (SA-12)', () => {
  it('shows the server data as returned, masked, view only', () => {
    const { container } = renderWithProviders(<MembersPage />);
    const table = screen.getByRole('table', { name: /회원 목록/ });
    expect(screen.getByRole('note')).toHaveTextContent('보기 전용');
    expect(within(table).getByText('zqxh***@example.test')).toBeInTheDocument();
    expect(within(table).getByText('010-****-5678')).toBeInTheDocument();
    expect(within(table).getByText('카카오')).toBeInTheDocument();
    expect(within(table).getByText('11,500원')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(RAW_EMAIL);
    expect(container.innerHTML).not.toContain(RAW_PHONE);
    expect(
      screen.queryByRole('button', { name: /정지|해제|수정|삭제|조정|추가/ }),
    ).not.toBeInTheDocument();
  });

  it('labels an email login', () => {
    api.list.data = { members: [{ ...hana, provider: 'EMAIL' }], total: 1 };
    renderWithProviders(<MembersPage />);
    expect(screen.getByText('이메일')).toBeInTheDocument();
  });

  it('asks the server to search by what was typed, after a short pause', async () => {
    renderWithProviders(<MembersPage />);
    expect(api.useMembers).toHaveBeenLastCalledWith(expect.anything(), {
      search: '',
      limit: 50,
      offset: 0,
    });
    await userEvent.type(screen.getByLabelText('검색'), 'A-41');
    await waitFor(() =>
      expect(api.useMembers).toHaveBeenLastCalledWith(expect.anything(), {
        search: 'A-41',
        limit: 50,
        offset: 0,
      }),
    );
  });

  it('pages with the server total', async () => {
    api.list.data = { members: [hana], total: 120 };
    renderWithProviders(<MembersPage />);
    expect(screen.getByText(/총 120명/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(api.useMembers).toHaveBeenLastCalledWith(expect.anything(), {
      search: '',
      limit: 50,
      offset: 50,
    });
  });

  it('shows empty, loading and error states', () => {
    api.list.data = { members: [], total: 0 };
    const empty = renderWithProviders(<MembersPage />);
    expect(screen.getByText('아직 가입한 회원이 없어요')).toBeInTheDocument();
    empty.unmount();
    api.list.status = 'pending';
    const loading = renderWithProviders(<MembersPage />);
    expect(screen.getByText('회원 목록을 불러오는 중이에요')).toBeInTheDocument();
    loading.unmount();
    api.list.status = 'error';
    renderWithProviders(<MembersPage />);
    expect(screen.getByRole('button', { name: /다시/ })).toBeInTheDocument();
  });
});

describe('MemberDetailPage (SA-12)', () => {
  it('keeps Olive Stamps and Coupon Points in separate sections with the server balances', () => {
    const { container } = renderDetail();
    const stamps = screen.getByRole('region', { name: '올리브 스탬프' });
    const points = screen.getByRole('region', { name: '쿠폰 포인트' });
    expect(within(stamps).getByText('3개')).toBeInTheDocument();
    expect(within(stamps).getByText('+1개')).toBeInTheDocument();
    expect(within(stamps).queryByText('4,000원')).not.toBeInTheDocument();
    expect(within(points).getByText('4,000원')).toBeInTheDocument();
    expect(within(points).getByText('+4,000원')).toBeInTheDocument();
    expect(within(points).getByText(/탈퇴 소멸/)).toBeInTheDocument();
    expect(within(points).queryByText('+1개')).not.toBeInTheDocument();
    expect(screen.getByText('zqxh***@example.test')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(RAW_EMAIL);
  });

  it('links each order to the order detail', () => {
    renderDetail();
    expect(screen.getByRole('link', { name: '주문 A-41 상세 보기' })).toHaveAttribute(
      'href',
      '/admin/orders?order=o1',
    );
  });

  it('says the member was not found for NOT_FOUND', () => {
    api.detail.status = 'error';
    api.detail.isError = true;
    api.detail.error = new AppError('NOT_FOUND');
    api.detail.data = undefined;
    renderDetail();
    expect(screen.getByText('회원을 찾을 수 없어요')).toBeInTheDocument();
  });

  it('offers a retry for other failures, including FORBIDDEN', () => {
    api.detail.status = 'error';
    api.detail.isError = true;
    api.detail.error = new AppError('FORBIDDEN');
    api.detail.data = undefined;
    renderDetail();
    expect(screen.getByRole('button', { name: /다시/ })).toBeInTheDocument();
  });
});
