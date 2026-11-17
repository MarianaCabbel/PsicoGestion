// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedLayout } from './protected-layout';

const { sessionState, themeState, pathnameState, replaceMock, logoutMock } = vi.hoisted(() => ({
  sessionState: {
    user: {
      id: 1,
      nombre_completo: 'Ana López',
      correo_institucional: 'ana@correo.uady.mx',
      rol: 'administrador',
    } as
      | { id: number; nombre_completo: string; correo_institucional: string; rol: string }
      | null,
    status: 'authenticated' as 'loading' | 'authenticated' | 'unauthenticated' | 'error',
    error: null as string | null,
    refresh: vi.fn(),
    logout: vi.fn(),
  },
  themeState: { theme: 'light' as 'light' | 'dark', toggleTheme: vi.fn() },
  pathnameState: { current: '/agenda' },
  replaceMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock('@/components/providers/session-provider', () => ({ useSession: () => sessionState }));

vi.mock('@/components/providers/theme-provider', () => ({ useTheme: () => themeState }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, ...rest } = props;
    return <img {...rest} alt={String(rest.alt ?? '')} />;
  },
}));

function renderLayout() {
  return render(
    <ProtectedLayout>
      <p>Contenido de la agenda</p>
    </ProtectedLayout>,
  );
}

function dialog() {
  return document.querySelector('dialog') as HTMLDialogElement;
}

describe('Menú y sesión CP4-INT', () => {
  beforeEach(() => {
    sessionState.user = {
      id: 1,
      nombre_completo: 'Ana López',
      correo_institucional: 'ana@correo.uady.mx',
      rol: 'administrador',
    };
    sessionState.status = 'authenticated';
    sessionState.error = null;
    sessionState.logout = logoutMock;
    themeState.theme = 'light';
    themeState.toggleTheme.mockReset();
    pathnameState.current = '/agenda';
    replaceMock.mockReset();
    logoutMock.mockReset();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    });
  });

  it('CP4-INT-29 muestra la navegación lateral y marca la sección actual', () => {
    renderLayout();

    expect(screen.getByText('Contenido de la agenda')).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/panel');
    expect(within(nav).getByRole('link', { name: /Agenda/ })).toHaveAttribute('href', '/agenda');
    expect(within(nav).getByRole('link', { name: /Pacientes/ })).toHaveAttribute(
      'href',
      '/pacientes',
    );
    expect(within(nav).getByRole('link', { name: /Citas/ })).toHaveAttribute('href', '/citas');
    expect(within(nav).getByRole('link', { name: /Salas/ })).toHaveAttribute('href', '/salas');
    expect(within(nav).getByRole('link', { name: /Terapeutas/ })).toHaveAttribute(
      'href',
      '/terapeutas',
    );
    expect(within(nav).getByRole('link', { name: /Agenda/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('CP4-INT-30 muestra al usuario de la sesión y las secciones de administración', () => {
    renderLayout();

    expect(screen.getByText('Ana López')).toBeVisible();
    expect(screen.getByText('Administrador')).toBeVisible();
    expect(screen.getByRole('link', { name: /Bitácora/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios y accesos/ })).toBeInTheDocument();
  });

  it('CP4-INT-31 pide confirmación antes de cerrar la sesión', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(dialog()).toHaveAttribute('open');
    expect(within(dialog()).getByText('¿Seguro que quieres cerrar la sesión?')).toBeVisible();
    expect(logoutMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(logoutMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('CP4-INT-34 al confirmar cierra la sesión y regresa al acceso', async () => {
    logoutMock.mockResolvedValue(undefined);
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  it('CP4-INT-35 abre y cierra el menú móvil con el botón y con Escape', () => {
    renderLayout();

    const barra = screen.getByLabelText('Barra lateral');
    expect(barra).not.toHaveClass('is-open');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(barra).toHaveClass('is-open');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(barra).not.toHaveClass('is-open');
  });
});
