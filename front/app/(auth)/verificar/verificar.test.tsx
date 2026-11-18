// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerificarPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

describe('VerificarPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    window.sessionStorage.clear();
  });

  it('renders the email verification form', async () => {
    render(<VerificarPage />);
    expect(screen.getByLabelText(/correo institucional/i)).toBeVisible();
    expect(screen.getByLabelText(/código de verificación/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /verificar cuenta/i })).toBeVisible();
  });

  it('resends a verification code to the institutional email', async () => {
    apiMock.mockResolvedValue({ data: undefined });
    const user = userEvent.setup();
    render(<VerificarPage />);
    await user.type(screen.getByLabelText(/correo institucional/i), 'ana@uady.mx');
    await user.click(screen.getByRole('button', { name: /reenviar código/i }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/auth/reenviar-codigo',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
