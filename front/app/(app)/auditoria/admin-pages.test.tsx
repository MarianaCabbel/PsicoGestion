// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditoriaPage from './page';

type SessionState = {
  user: { id: number; nombre_completo: string; rol: string } | null;
};

const { apiMock, sessionState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  sessionState: {
    user: { id: 1, nombre_completo: 'Admin User', rol: 'administrador' },
  } as SessionState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/auditoria',
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

const emptyResult = { items: [], page: 1, total: 0, total_paginas: 1 };

describe('AuditoriaPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    sessionState.user = { id: 1, nombre_completo: 'Admin User', rol: 'administrador' };
    apiMock.mockResolvedValue({ data: emptyResult });
  });

  it('renders the audit page header and filter form (as admin)', async () => {
    render(<AuditoriaPage />);
    expect(screen.getByRole('heading', { name: /bitácora de auditoría/i })).toBeVisible();
    // Input labels have no htmlFor/id, so query them as text instead of getByLabelText.
    expect(screen.getByText('Acción')).toBeVisible();
    expect(screen.getByText('Entidad')).toBeVisible();
    expect(screen.getByText('Desde')).toBeVisible();
    expect(screen.getByText('Hasta')).toBeVisible();
    expect(screen.getByRole('button', { name: /aplicar filtros/i })).toBeVisible();
  });

  it('shows access denied for non-admin users', async () => {
    sessionState.user = { id: 1, nombre_completo: 'Test User', rol: 'usuario' };
    render(<AuditoriaPage />);
    expect(
      screen.getByText(/disponible únicamente para administración/i),
    ).toBeVisible();
  });

  it('loads auditoría entries from API', async () => {
    apiMock.mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            usuario_id: 1,
            accion: 'Creación',
            entidad: 'Paciente',
            entidad_id: 1,
            detalle: { campos: ['nombre'], aviso_version: '1.0' },
            created_at: '2026-10-20T10:00:00Z',
          },
          {
            id: 2,
            usuario_id: 2,
            accion: 'Actualización',
            entidad: 'Cita',
            entidad_id: 5,
            detalle: null,
            created_at: '2026-10-20T11:00:00Z',
          },
        ],
        page: 1,
        total: 2,
        total_paginas: 1,
      },
    });

    render(<AuditoriaPage />);
    await waitFor(() => expect(screen.getByText('Creación')).toBeVisible());
    expect(screen.getByText('Actualización')).toBeVisible();
    expect(screen.getByText('2 registros')).toBeVisible();
  });

  it('handles empty state when no audit entries', async () => {
    render(<AuditoriaPage />);
    await waitFor(() =>
      expect(screen.getByText('No hay registros de auditoría')).toBeVisible(),
    );
    expect(screen.getByText('Prueba con otros filtros.')).toBeVisible();
  });
});
