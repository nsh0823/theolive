import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthError, createSupabaseClient } from '@theolive/api';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AUTH_STATUS } from './accessRules';
import { SupabaseContext } from './AuthContext';
import { LoginPage } from './LoginPage';

function setup() {
  const client = createSupabaseClient({
    url: 'http://127.0.0.1:1',
    anonKey: 'test-key',
    storage: window.localStorage,
  });
  const signIn = vi.spyOn(client.auth, 'signInWithPassword');
  renderWithProviders(
    <SupabaseContext.Provider value={client}>
      <LoginPage />
    </SupabaseContext.Provider>,
    '/login',
    { status: AUTH_STATUS.SIGNED_OUT },
  );
  return signIn;
}

describe('LoginPage', () => {
  it('rejects an invalid email without calling the server', async () => {
    const signIn = setup();
    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 형식');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows one generic message when the server refuses the credentials', async () => {
    const signIn = setup();
    signIn.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    await userEvent.type(screen.getByLabelText('이메일'), 'staff@theolive.local');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호를 확인해 주세요.'),
    );
    expect(signIn).toHaveBeenCalledWith({
      email: 'staff@theolive.local',
      password: 'wrong-password',
    });
  });
});
