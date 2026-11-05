import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError, type AnnouncementView } from '@theolive/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { NoticesPage } from './NoticesPage';

const api = vi.hoisted(() => {
  const list: { status: 'success' | 'error' | 'pending'; data: unknown; refetch: () => void } = {
    status: 'success',
    data: undefined,
    refetch: () => undefined,
  };
  return { list, save: vi.fn(), setStatus: vi.fn(), remove: vi.fn() };
});

vi.mock('@theolive/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@theolive/api')>()),
  useAnnouncementsAdmin: () => api.list,
  useSaveAnnouncement: () => ({ mutate: api.save, isPending: false }),
  useSetAnnouncementStatus: () => ({ mutate: api.setStatus, isPending: false }),
  useDeleteAnnouncement: () => ({ mutate: api.remove, isPending: false }),
}));

const published: AnnouncementView = {
  id: 'n1',
  title: '추석 연휴 영업 시간 안내',
  body: '연휴 기간에는 오전 10시부터 운영합니다.',
  status: 'PUBLISHED',
  publishedAt: '2026-10-28T09:10:00Z',
  createdAt: '2026-10-28T09:00:00Z',
  updatedAt: '2026-10-28T09:10:00Z',
};
const draft: AnnouncementView = {
  ...published,
  id: 'n2',
  title: '이벤트 준비 중',
  status: 'UNPUBLISHED',
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.list.status = 'success';
  api.list.data = [published, draft];
});

describe('NoticesPage (공지, admin CRUD)', () => {
  it('lists announcements with the server dates', () => {
    renderWithProviders(<NoticesPage />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('추석 연휴 영업 시간 안내')).toBeInTheDocument();
    expect(within(table).getByText('게시 중')).toBeInTheDocument();
    expect(within(table).getByText('비공개')).toBeInTheDocument();
  });

  it('creates an announcement without ever sending a date', async () => {
    renderWithProviders(<NoticesPage />);
    await userEvent.click(screen.getAllByRole('button', { name: '공지 작성' })[0] ?? document.body);
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('제목'), ' 새 공지 ');
    await userEvent.type(within(dialog).getByLabelText('내용'), '본문');
    await userEvent.click(within(dialog).getByLabelText('게시 중'));
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0]?.[0]).toEqual({
      id: null,
      title: '새 공지',
      body: '본문',
      status: 'PUBLISHED',
    });
  });

  it('validates with the shared messages and does not call the server', async () => {
    renderWithProviders(<NoticesPage />);
    await userEvent.click(screen.getAllByRole('button', { name: '공지 작성' })[0] ?? document.body);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }));
    expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('내용을 입력해 주세요.')).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('shows a server refusal inside the dialog and keeps it open', async () => {
    api.save.mockImplementation((_input: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(new AppError('FORBIDDEN')),
    );
    renderWithProviders(<NoticesPage />);
    await userEvent.click(screen.getByRole('button', { name: `${published.title} 수정` }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 작업을 할 권한이 없어요.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(api.save.mock.calls[0]?.[0]).toMatchObject({ id: 'n1' });
  });

  it('publishes a draft and unpublishes a published one by sending only the status', async () => {
    renderWithProviders(<NoticesPage />);
    await userEvent.click(screen.getByRole('button', { name: `${draft.title} 게시` }));
    expect(api.setStatus.mock.calls[0]?.[0]).toEqual({ id: 'n2', status: 'PUBLISHED' });
    await userEvent.click(screen.getByRole('button', { name: `${published.title} 비공개로 전환` }));
    expect(api.setStatus.mock.calls[1]?.[0]).toEqual({ id: 'n1', status: 'UNPUBLISHED' });
  });

  it('deletes only after confirmation', async () => {
    renderWithProviders(<NoticesPage />);
    await userEvent.click(screen.getByRole('button', { name: `${draft.title} 삭제` }));
    expect(api.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(api.remove.mock.calls[0]?.[0]).toBe('n2'));
  });

  it('shows empty, loading and error states', () => {
    api.list.data = [];
    const empty = renderWithProviders(<NoticesPage />);
    expect(screen.getByText('작성된 공지가 없어요')).toBeInTheDocument();
    empty.unmount();
    api.list.status = 'pending';
    const loading = renderWithProviders(<NoticesPage />);
    expect(screen.getByText('공지를 불러오는 중이에요')).toBeInTheDocument();
    loading.unmount();
    api.list.status = 'error';
    renderWithProviders(<NoticesPage />);
    expect(screen.getByRole('button', { name: /다시/ })).toBeInTheDocument();
  });
});
