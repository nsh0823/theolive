import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '../app/(auth)/sign-in';

const mockSignIn = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/services/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) } },
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignInScreen />
    </QueryClientProvider>,
  );
}

describe('SignInScreen', () => {
  it('signs in with the entered credentials', async () => {
    await renderScreen();
    expect(screen.getByText('Welcome')).toBeOnTheScreen();

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
