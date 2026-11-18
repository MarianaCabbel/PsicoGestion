// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecuperarPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

describe('RecuperarPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('renders the password recovery form', async () => {
    render(<RecuperarPage />);
    expect(screen.getByLabelText(/correo institucional/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /enviar instrucciones/i })).toBeVisible();
  });

  it('requests recovery instructions for the institutional email', async () => {
    apiMock.mockResolvedValue({ data: undefined, message: 'Revisa tu correo.' });
    const user = userEvent.setup();
    render(<RecuperarPage />);
    await user.type(screen.getByLabelText(/correo institucional/i), 'ana@uady.mx');
    await user.click(screen.getByRole('button', { name: /enviar instrucciones/i }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/auth/recuperar',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /revisa tu correo/i })).toBeVisible(),
    );
  });
});
