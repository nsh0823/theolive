import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '@/ui/Toast';

export function renderWithProviders(ui: ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}
