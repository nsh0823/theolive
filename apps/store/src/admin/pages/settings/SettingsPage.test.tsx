import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SettingsPage } from './SettingsPage';

/** The card (section) that holds a heading, so "저장" is unambiguous on a page with several. */
function card(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (!section) throw new Error(`no card for ${heading}`);
  return section;
}

describe('SettingsPage (Store Admin 매장 설정)', () => {
  it('shows the server store info, status and hours', async () => {
    renderWithProviders(<SettingsPage />, '/admin/settings');
    expect(await screen.findByLabelText('매장 이름')).toHaveValue('더 올리브 카페');
    expect(screen.getByText('영업 중')).toBeInTheDocument();
    expect(screen.getByLabelText('월요일 오픈 시간')).toHaveValue('08:00');
    expect(screen.getByLabelText('일요일 오픈 시간')).toBeDisabled();
  });

  it('shows an error state with retry', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    fake.failWith('read:store_settings', 'boom');
    expect(await screen.findByText('데이터를 불러오지 못했어요')).toBeInTheDocument();
    fake.clearFailure('read:store_settings');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByLabelText('매장 이름')).toBeInTheDocument();
  });

  it('saves store info and refuses an empty name', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    const name = await screen.findByLabelText('매장 이름');
    await userEvent.clear(name);
    await userEvent.click(within(card('매장 정보')).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('매장 이름을 입력해 주세요.')).toBeInTheDocument();
    expect(fake.tables.store_settings?.[0]?.name).toBe('더 올리브 카페');

    await userEvent.type(name, '새 이름');
    await userEvent.click(within(card('매장 정보')).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fake.tables.store_settings?.[0]?.name).toBe('새 이름'));
  });

  it('toggles order acceptance through the status RPC', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    await userEvent.click(await screen.findByRole('switch', { name: /주문 접수: 접수 가능/ }));
    await waitFor(() => expect(fake.tables.store_settings?.[0]?.is_accepting_orders).toBe(false));
    expect(await screen.findByRole('switch', { name: /주문 접수: 일시 중지/ })).toBeInTheDocument();
  });

  it('shows the server refusal when a status change is denied', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    fake.failWith('set_store_status', 'FORBIDDEN');
    await userEvent.click(await screen.findByRole('switch', { name: /영업 상태: 영업 중/ }));
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /영업 상태: 영업 중/ })).toBeInTheDocument();
  });

  it('refuses hours where closing is not after opening, and saves a valid week', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    await screen.findByLabelText('화요일 오픈 시간');
    await userEvent.clear(screen.getByLabelText('화요일 마감 시간'));
    await userEvent.type(screen.getByLabelText('화요일 마감 시간'), '07:00');
    await userEvent.click(within(card('영업 시간')).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('마감 시간이 오픈 시간보다 늦어야 해요.')).toBeInTheDocument();
    expect(fake.tables.business_hours?.[1]?.closes_at).toBe('21:00:00');

    await userEvent.clear(screen.getByLabelText('화요일 마감 시간'));
    await userEvent.type(screen.getByLabelText('화요일 마감 시간'), '22:30');
    await userEvent.click(within(card('영업 시간')).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fake.tables.business_hours?.[1]?.closes_at).toBe('22:30'));
  });

  it('saves a notification setting', async () => {
    const { fake } = renderWithProviders(<SettingsPage />, '/admin/settings');
    await userEvent.click(await screen.findByRole('switch', { name: '품절 상태 리마인드' }));
    await waitFor(() => expect(fake.tables.store_settings?.[0]?.sold_out_reminder).toBe(true));
  });
});
