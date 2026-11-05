import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createCategories, createMenu } from '@/data/fixtures/menu';
import { MenuFormDialog } from './MenuFormDialog';

const categories = createCategories();

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

  it('requires at least one of HOT/ICE, a name and a price', async () => {
    const onSave = vi.fn();
    render(
      <MenuFormDialog target="new" categories={categories} onClose={vi.fn()} onSave={onSave} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'HOT' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ICE' }));
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByText('HOT 또는 ICE를 하나 이상 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('메뉴 이름을 입력해 주세요.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
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
        categoryId: 'coffee',
      }),
      null,
    );
  });

  it('pre-fills an existing item when editing', () => {
    const cold = createMenu().find((item) => item.id === 'cold-brew');
    if (!cold) throw new Error('fixture missing');
    render(
      <MenuFormDialog target={cold} categories={categories} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getByLabelText('메뉴 이름')).toHaveValue('콜드브루');
    expect(screen.getByRole('checkbox', { name: 'ICE' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'HOT' })).not.toBeChecked();
  });
});
