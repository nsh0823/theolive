import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { toStaffAccess } from '@theolive/api';
import { STAFF_PERMISSION, STAFF_ROLE } from '@theolive/types';
import { renderWithProviders, TEST_ADMIN_STATE } from '@/test/render';
import { ACCESS_RULE, AUTH_STATUS, type AccessRule, type AuthState } from './accessRules';
import { RequireAccess } from './RequireAccess';

function signedIn(access: ReturnType<typeof toStaffAccess> | null): AuthState {
  return { status: AUTH_STATUS.SIGNED_IN, userId: 'u', email: null, displayName: 'n', access };
}

const barista = signedIn(
  toStaffAccess({
    role: STAFF_ROLE.STAFF,
    permissions: [STAFF_PERMISSION.PROCESS_ORDERS],
    is_active: true,
  }),
);

function renderGate(rule: AccessRule, path: string, state: AuthState) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route element={<RequireAccess rule={rule} />}>
        <Route path={path} element={<p>protected content</p>} />
      </Route>
    </Routes>,
    path,
    state,
  );
}

describe('RequireAccess', () => {
  it('redirects signed-out visitors to the login page', () => {
    renderGate(ACCESS_RULE.PROCESS_ORDERS, '/orders', { status: AUTH_STATUS.SIGNED_OUT });
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows a waiting state while the role loads, never the content', () => {
    renderGate(ACCESS_RULE.ADMIN, '/admin', { status: AUTH_STATUS.LOADING });
    expect(screen.getByText('계정 권한을 확인하고 있어요')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('offers a retry when the role could not be loaded', () => {
    renderGate(ACCESS_RULE.ADMIN, '/admin', { status: AUTH_STATUS.ERROR });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('lets staff with PROCESS_ORDERS into /orders but not /admin', () => {
    renderGate(ACCESS_RULE.PROCESS_ORDERS, '/orders', barista);
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('denies staff on /admin and points them back to the order screen', () => {
    renderGate(ACCESS_RULE.ADMIN, '/admin', barista);
    expect(screen.getByRole('alert')).toHaveTextContent('권한이 없는');
    expect(screen.getByRole('link', { name: '주문 화면으로' })).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('denies customer accounts (no staff row) on both surfaces', () => {
    renderGate(ACCESS_RULE.PROCESS_ORDERS, '/orders', signedIn(null));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('allows an admin on /admin', () => {
    renderGate(ACCESS_RULE.ADMIN, '/admin', TEST_ADMIN_STATE);
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
