import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '../app/(auth)/sign-in';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockSignIn = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/services/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) } },
}));

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SignInScreen />
    </QueryClientProvider>,
  );
}

describe('SignInScreen', () => {
  it('offers the four PRD social providers', async () => {
    await renderScreen();
    for (const label of [
      '카카오로 계속하기',
      '네이버로 계속하기',
      'Google로 계속하기',
      'Apple로 계속하기',
    ]) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
  });

  it('blocks social login until both required consents are checked', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('카카오로 계속하기'));
    expect(screen.queryByText('소셜 로그인은 아직 연결되지 않았어요.')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('(필수) 이용약관에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('(필수) 개인정보 처리방침에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('카카오로 계속하기'));
    expect(screen.getByText('소셜 로그인은 아직 연결되지 않았어요.')).toBeOnTheScreen();
  });

  it('shows the official logo with an accessible label', async () => {
    await renderScreen();
    expect(screen.getByLabelText("더올리브 The O'live 로고")).toBeOnTheScreen();
  });

  it('tells the user social login is not connected yet', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('(필수) 이용약관에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('(필수) 개인정보 처리방침에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('카카오로 계속하기'));
    expect(screen.getByText('소셜 로그인은 아직 연결되지 않았어요.')).toBeOnTheScreen();
  });

  it('keeps the dev-only email sign-in working', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    await fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      }),
    );
  });
});
