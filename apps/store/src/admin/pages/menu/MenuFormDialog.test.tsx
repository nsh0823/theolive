import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuCategory, MenuItem } from '@/domain/models';
import { FAKE_IDS } from '@/test/fakeSupabase';
import { MenuFormDialog } from './MenuFormDialog';

const categories: MenuCategory[] = [
  { id: FAKE_IDS.coffee, name: '커피', isActive: true, sortOrder: 1 },
  { id: FAKE_IDS.latte, name: '라떼', isActive: true, sortOrder: 2 },
];

const coldBrew: MenuItem = {
  id: '00000000-0000-4000-8000-000000000202',
  categoryId: FAKE_IDS.coffee,
  name: '콜드브루',
  description: '저온에서 오래 우려낸 부드러운 커피',
  price: 5000,
  temperatures: ['ICE'],
  isSoldOut: false,
  isActive: true,
  imagePath: null,
  imageUrl: null,
};

const NO_IMAGE_CHANGE = { file: null, isRemoved: false };

describe('MenuFormDialog', () => {
  it('offers HOT and ICE as the only options (no size, syrup, milk or shot)', () => {
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: '메뉴 추가' });
    const options = within(dialog)
      .getAllByRole('checkbox')
      .map((box) => box.parentElement?.textContent?.trim());
    expect(options).toEqual(['HOT', 'ICE']);
    expect(dialog.textContent).not.toMatch(/사이즈|시럽|우유 변경|샷 추가|토핑/);
  });

  it('requires a name and a price, but not a temperature (OQ-16)', async () => {
    const onSave = vi.fn();
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={onSave} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'HOT' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ICE' }));
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByText('메뉴 이름을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText(/가격은 1원 이상/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a menu item that has no temperature choice', async () => {
    const onSave = vi.fn();
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={onSave} />,
    );
    await userEvent.type(screen.getByLabelText('메뉴 이름'), '병 음료');
    await userEvent.type(screen.getByLabelText('가격 (원)'), '3000');
    await userEvent.click(screen.getByRole('checkbox', { name: 'HOT' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ICE' }));
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: '병 음료', price: 3000, temperatures: [] }),
      null,
      NO_IMAGE_CHANGE,
    );
  });

  it('saves a valid new menu item with its temperatures', async () => {
    const onSave = vi.fn();
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={onSave} />,
    );
    await userEvent.type(screen.getByLabelText('메뉴 이름'), '플랫 화이트');
    await userEvent.type(screen.getByLabelText('가격 (원)'), '5300');
    await userEvent.click(screen.getByRole('checkbox', { name: 'ICE' }));
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '플랫 화이트',
        price: 5300,
        temperatures: ['HOT'],
        categoryId: FAKE_IDS.coffee,
      }),
      null,
      NO_IMAGE_CHANGE,
    );
  });

  it('pre-fills an existing item when editing', () => {
    render(
      <MenuFormDialog
        target={coldBrew}
        categories={categories}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('메뉴 이름')).toHaveValue('콜드브루');
    expect(screen.getByRole('checkbox', { name: 'ICE' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'HOT' })).not.toBeChecked();
  });

  it('rejects an unsupported image type before anything uploads', async () => {
    const onSave = vi.fn();
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={onSave} />,
    );
    const input = screen.getByLabelText('메뉴 이미지 파일');
    await userEvent.upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }), {
      applyAccept: false,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG, WEBP');
  });

  it('passes a chosen image to onSave and disables saving while it is in flight', async () => {
    const onSave = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    render(
      <MenuFormDialog
        target="new"
        categories={categories}
        isSaving
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    const photo = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('메뉴 이미지 파일'), photo);
    expect(screen.getByRole('button', { name: '이미지 변경' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
  });
});
