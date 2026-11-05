import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FAKE_IDS } from '@/test/fakeSupabase';
import { renderWithProviders } from '@/test/render';
import { MenuPage } from './MenuPage';

async function openNewItemForm() {
  await userEvent.click(await screen.findByRole('button', { name: '메뉴 추가' }));
  return screen.findByRole('dialog', { name: '메뉴 추가' });
}

describe('MenuPage (Store Admin 메뉴 관리)', () => {
  it('lists the server menu with category counts', async () => {
    renderWithProviders(<MenuPage />, '/admin/menu');
    expect(await screen.findByText('아메리카노')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '메뉴 카테고리' });
    expect(within(nav).getByRole('button', { name: /전체/ })).toHaveTextContent('5');
    expect(within(nav).getByRole('button', { name: /^커피/ })).toHaveTextContent('2');
  });

  it('shows an error state with retry, then the list once the server recovers', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    fake.failWith('read:menu_items', 'boom');
    expect(await screen.findByText('데이터를 불러오지 못했어요')).toBeInTheDocument();
    fake.clearFailure('read:menu_items');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('아메리카노')).toBeInTheDocument();
  });

  it('shows the empty state for a category without items', async () => {
    renderWithProviders(<MenuPage />, '/admin/menu');
    await screen.findByText('아메리카노');
    await userEvent.click(screen.getByRole('button', { name: /논커피/ }));
    expect(screen.getByText('이 카테고리에 메뉴가 없어요')).toBeInTheDocument();
  });

  it('creates a menu item with an image and shows it in the list', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    const dialog = await openNewItemForm();
    await userEvent.type(within(dialog).getByLabelText('메뉴 이름'), '플랫 화이트');
    await userEvent.type(within(dialog).getByLabelText('가격 (원)'), '5300');
    await userEvent.upload(
      within(dialog).getByLabelText('메뉴 이미지 파일'),
      new File(['x'], 'a.png', { type: 'image/png' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(await screen.findByText('플랫 화이트')).toBeInTheDocument();
    const saved = fake.tables.menu_items?.find((row) => row.name === '플랫 화이트');
    expect(saved).toMatchObject({ price: 5300, category_id: FAKE_IDS.coffee });
    expect(fake.calls.uploads).toHaveLength(1);
    expect(saved?.image_path).toBe(fake.calls.uploads[0]);
  });

  it('keeps the dialog open, explains the refusal and removes the upload when saving fails', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    fake.failWith('menu_items', 'FORBIDDEN');
    const dialog = await openNewItemForm();
    await userEvent.type(within(dialog).getByLabelText('메뉴 이름'), '거절될 메뉴');
    await userEvent.type(within(dialog).getByLabelText('가격 (원)'), '5300');
    await userEvent.upload(
      within(dialog).getByLabelText('메뉴 이미지 파일'),
      new File(['x'], 'a.png', { type: 'image/png' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '메뉴 추가' })).toBeInTheDocument();
    await waitFor(() => expect(fake.calls.removed).toEqual(fake.calls.uploads));
  });

  it('edits the price of an existing item', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    await userEvent.click(await screen.findByRole('button', { name: '아메리카노 수정' }));
    const dialog = await screen.findByRole('dialog', { name: '메뉴 수정' });
    const price = within(dialog).getByLabelText('가격 (원)');
    await userEvent.clear(price);
    await userEvent.type(price, '4700');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(fake.tables.menu_items?.find((row) => row.id === FAKE_IDS.americano)?.price).toBe(
        4700,
      ),
    );
    expect(await screen.findByText('4,700원')).toBeInTheDocument();
  });

  it('archives instead of deleting and the item leaves the list', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    await userEvent.click(await screen.findByRole('button', { name: '아메리카노 삭제' }));
    const confirm = await screen.findByRole('dialog', { name: /메뉴를 삭제할까요/ });
    await userEvent.click(within(confirm).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByText('아메리카노')).not.toBeInTheDocument());
    const row = fake.tables.menu_items?.find((candidate) => candidate.id === FAKE_IDS.americano);
    expect(row).toBeDefined();
    expect(row?.archived_at).toEqual(expect.any(String));
  });

  it('toggles sold-out through the server', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    await userEvent.click(await screen.findByRole('switch', { name: '품절 처리: 아메리카노' }));
    await waitFor(() =>
      expect(
        fake.tables.menu_items?.find((row) => row.id === FAKE_IDS.americano)?.is_sold_out,
      ).toBe(true),
    );
  });

  it('adds a category and saves the order of all categories', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    await userEvent.click(await screen.findByRole('button', { name: '카테고리 관리' }));
    const dialog = await screen.findByRole('dialog', { name: '카테고리 관리' });
    await userEvent.type(within(dialog).getByLabelText('새 카테고리 이름'), '시즌');
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '시즌 위로 이동' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fake.tables.menu_categories).toHaveLength(6));
    const reorder = fake.calls.rpc.find((call) => call.name === 'admin_reorder_categories');
    expect(reorder?.args).toEqual({ p_ids: expect.any(Array) });
    expect(reorder?.args).toEqual({ p_ids: expect.arrayContaining([FAKE_IDS.coffee]) });
    expect(Object.values(reorder?.args ?? {})[0]).toHaveLength(6);
    expect(await screen.findByRole('button', { name: /시즌/ })).toBeInTheDocument();
  });

  it('blocks a duplicate category name and shows a server refusal inside the dialog', async () => {
    const { fake } = renderWithProviders(<MenuPage />, '/admin/menu');
    await userEvent.click(await screen.findByRole('button', { name: '카테고리 관리' }));
    const dialog = await screen.findByRole('dialog', { name: '카테고리 관리' });
    await userEvent.type(within(dialog).getByLabelText('새 카테고리 이름'), '커피');
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(within(dialog).getByText('같은 이름의 카테고리가 있어요.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();

    const duplicate = within(dialog).getAllByLabelText(/카테고리 이름: 커피/)[1];
    if (!duplicate) throw new Error('draft row missing');
    await userEvent.clear(duplicate);
    await userEvent.type(duplicate, '시즌');
    fake.failWith('admin_reorder_categories', 'FORBIDDEN');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(await within(dialog).findByText('이 작업을 할 권한이 없어요.')).toBeInTheDocument();
  });
});
