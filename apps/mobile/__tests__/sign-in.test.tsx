import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '../app/(auth)/sign-in';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

const mockSignIn = jest.fn().mockResolvedValue({ error: null });

const mockOAuth = jest.fn();
const mockOpenAuthSession = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signInWithOAuth: (...args: unknown[]) => mockOAuth(...args),
    },
  },
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `theolive://${path}`,
  parse: (url: string) => ({
    queryParams: Object.fromEntries(new URL(url).searchParams.entries()),
  }),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
}));

jest.mock('@/env', () => ({
  env: {
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test',
    enableDevLogin: true,
  },
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

const SOCIAL_FAILED_TEXT = '로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';

describe('SignInScreen', () => {
  beforeEach(() => {
    mockOAuth
      .mockReset()
      .mockResolvedValue({ data: { url: 'https://provider.test/auth' }, error: null });
    mockOpenAuthSession
      .mockReset()
      .mockResolvedValue({ type: 'success', url: 'theolive://callback?code=abc' });
    mockReplace.mockClear();
  });

  it('offers the three launch providers (Naver comes later)', async () => {
    await renderScreen();
    for (const label of ['카카오로 계속하기', 'Google로 계속하기', 'Apple로 계속하기']) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    expect(screen.queryByLabelText('네이버로 계속하기')).not.toBeOnTheScreen();
  });

  it('blocks social login until both required consents are checked', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('카카오로 계속하기'));
    expect(mockOAuth).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('(필수) 이용약관에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('(필수) 개인정보 처리방침에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('카카오로 계속하기'));
    await waitFor(() => expect(mockOAuth).toHaveBeenCalledTimes(1));
  });

  it('shows the official logo with an accessible label', async () => {
    await renderScreen();
    expect(screen.getByLabelText("더올리브 The O'live 로고")).toBeOnTheScreen();
  });

  async function pressProvider(label: string) {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('(필수) 이용약관에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('(필수) 개인정보 처리방침에 동의합니다'));
    await fireEvent.press(screen.getByLabelText(label));
  }

  it('opens the provider page in an auth session and hands the code to the callback route', async () => {
    await pressProvider('Google로 계속하기');
    await waitFor(() =>
      expect(mockOpenAuthSession).toHaveBeenCalledWith(
        'https://provider.test/auth',
        'theolive://callback',
      ),
    );
    expect(mockOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'theolive://callback', skipBrowserRedirect: true },
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/callback', params: { code: 'abc' } }),
    );
  });

  it.each(['cancel', 'dismiss'])('shows no message when the user %ss the sheet', async (type) => {
    mockOpenAuthSession.mockResolvedValue({ type });
    await pressProvider('카카오로 계속하기');
    await waitFor(() => expect(mockOpenAuthSession).toHaveBeenCalled());
    expect(screen.queryByText(SOCIAL_FAILED_TEXT)).not.toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tells the user when the redirect comes back without a code', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: 'theolive://callback?error=x' });
    await pressProvider('카카오로 계속하기');
    expect(await screen.findByText(SOCIAL_FAILED_TEXT)).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tells the user when the sign-in could not be started', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockOAuth.mockResolvedValue({ data: { url: null }, error: new Error('provider disabled') });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('(필수) 이용약관에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('(필수) 개인정보 처리방침에 동의합니다'));
    await fireEvent.press(screen.getByLabelText('Apple로 계속하기'));
    expect(
      await screen.findByText('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeOnTheScreen();
    consoleError.mockRestore();
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
