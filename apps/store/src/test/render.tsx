import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toStaffAccess, type StaffAccess } from '@theolive/api';
import { STAFF_ROLE } from '@theolive/types';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { AUTH_STATUS, type AuthState } from '@/auth/accessRules';
import { AuthContext, SupabaseContext } from '@/auth/AuthContext';
import { createFakeSupabase, type FakeSupabase } from './fakeSupabase';
import { ToastProvider } from '@/ui/Toast';

export const TEST_ADMIN_ACCESS: StaffAccess = toStaffAccess({
  role: STAFF_ROLE.ADMIN,
  permissions: [],
  is_active: true,
});

export const TEST_ADMIN_STATE: AuthState = {
  status: AUTH_STATUS.SIGNED_IN,
  userId: 'test-admin',
  email: 'admin@example.test',
  displayName: '김올리',
  access: TEST_ADMIN_ACCESS,
};

/** Renders with a router, toasts, a query client and a fake signed-in session (admin by default). */
export function renderWithProviders(
  ui: ReactElement,
  route = '/',
  authState: AuthState = TEST_ADMIN_STATE,
  fake: FakeSupabase = createFakeSupabase(),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <SupabaseContext.Provider value={fake.client}>
        <AuthContext.Provider
          value={{ state: authState, signOut: () => Promise.resolve(), retry: () => undefined }}
        >
          <MemoryRouter initialEntries={[route]}>
            <ToastProvider>{ui}</ToastProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      </SupabaseContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, fake, queryClient };
}
