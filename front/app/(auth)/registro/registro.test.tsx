// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegistroPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const validValues = {
  nombre: 'Ana Prueba',
  correo: 'ana@uady.mx',
  telefono: '9991234567',
  password: 'Password1!',
};

describe('RegistroPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('renders the registration form', async () => {
    render(<RegistroPage />);
    expect(screen.getByLabelText(/nombre completo/i)).toBeVisible();
    expect(screen.getByLabelText(/correo institucional/i)).toBeVisible();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
  });

  it('submits valid registration data', async () => {
    apiMock.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(<RegistroPage />);
    await user.type(screen.getByLabelText(/nombre completo/i), validValues.nombre);
    await user.type(screen.getByLabelText(/correo institucional/i), validValues.correo);
    await user.type(screen.getByLabelText(/teléfono/i), validValues.telefono);
    await user.type(screen.getByLabelText(/^contraseña$/i), validValues.password);
    await user.type(screen.getByLabelText(/confirmar contraseña/i), validValues.password);
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/auth/registro',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
