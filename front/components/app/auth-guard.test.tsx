// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth-guard';

const { sessionState, pathnameState, replaceMock } = vi.hoisted(() => ({
  sessionState: {
    status: 'loading' as 'loading' | 'authenticated' | 'unauthenticated' | 'error',
    error: null as string | null,
    refresh: vi.fn(),
  },
  pathnameState: { current: '/panel' },
  replaceMock: vi.fn(),
}));

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
  useRouter: () => ({ replace: replaceMock }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    sessionState.status = 'loading';
    sessionState.error = null;
    pathnameState.current = '/panel';
    replaceMock.mockClear();
  });

  it('redirige al acceso cuando no hay sesión en una ruta protegida', async () => {
    sessionState.status = 'unauthenticated';
    pathnameState.current = '/panel';

    render(
      <AuthGuard>
        <p>Contenido protegido</p>
      </AuthGuard>,
    );

    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cargando sesión')).toBeVisible();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  it('permite el acceso, el registro y la recuperación de contraseña sin sesión', () => {
    sessionState.status = 'unauthenticated';
    pathnameState.current = '/recuperar';

    render(
      <AuthGuard>
        <p>Recuperar contraseña</p>
      </AuthGuard>,
    );

    expect(screen.getByText('Recuperar contraseña')).toBeVisible();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('muestra las rutas protegidas cuando la sesión está autenticada', () => {
    sessionState.status = 'authenticated';
    pathnameState.current = '/privacidad';

    render(
      <AuthGuard>
        <p>Aviso de privacidad</p>
      </AuthGuard>,
    );

    expect(screen.getByText('Aviso de privacidad')).toBeVisible();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
