// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './session-provider';

const { apiMock, pathnameState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  pathnameState: { current: '/login' },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}));

const usuario = {
  id: 1,
  nombre_completo: 'Ana López',
  correo_institucional: 'ana@correo.uady.mx',
  rol: 'secretaria',
};

function Probe() {
  const { status, refresh } = useSession();
  return (
    <div>
      <span data-testid="estado-sesion">{status}</span>
      <button onClick={() => void refresh()}>Refrescar sesión</button>
    </div>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    apiMock.mockReset();
    pathnameState.current = '/login';
  });

  it('no consulta /api/auth/me en rutas públicas', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('estado-sesion')).toHaveTextContent('unauthenticated'),
    );
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('consulta la sesión una sola vez al entrar en una ruta protegida', async () => {
    apiMock.mockResolvedValue({ data: usuario });
    pathnameState.current = '/panel';

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    expect(apiMock).toHaveBeenCalledWith('/api/auth/me', { redirectOnUnauthorized: false });
  });

  it('permite refrescar explícitamente tras iniciar sesión desde una ruta pública', async () => {
    apiMock.mockResolvedValue({ data: usuario });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refrescar sesión' }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('estado-sesion')).toHaveTextContent('authenticated'),
    );
  });
});
