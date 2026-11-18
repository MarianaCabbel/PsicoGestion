// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/providers/theme-provider';
import LoginPage from './page';

const { apiMock, refreshMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => ({
    user: null,
    status: 'unauthenticated',
    error: null,
    refresh: refreshMock,
    logout: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    refreshMock.mockReset();
  });

  it('renders the login form', async () => {
    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText(/correo institucional/i)).toBeVisible();
    expect(screen.getByLabelText(/contraseña/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  it('submits the login form', async () => {
    apiMock.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/correo institucional/i), 'test@uady.mx');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
