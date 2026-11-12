// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PacientesPage from './page';

const { apiMock, sessionState } = vi.hoisted(() => ({
  apiMock:
    vi.fn<
      (
        path: string,
        options?: { method?: string; body?: { confirmacion?: string } },
      ) => Promise<{ data: unknown }>
    >(),
  sessionState: { user: { id: 1, rol: 'administrador' } },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});
vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

describe('Patient ARCO actions', () => {
  beforeEach(() => {
    apiMock.mockReset();
    sessionState.user = { id: 1, rol: 'administrador' };
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
    apiMock.mockImplementation((path: string) => {
      if (String(path).startsWith('/api/pacientes?')) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 12,
                nombre_completo: 'Paciente de prueba',
                curp: 'AAAA900101HYNRRL00',
                sexo: 'H',
                fecha_nacimiento: '1990-01-01',
                telefono: '9990000000',
                correo: null,
                estado: 'activo',
                consentimiento_at: null,
                anonimizado_at: null,
              },
            ],
            page: 1,
            limit: 10,
            total: 1,
            total_paginas: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('requires a second typed confirmation before sending anonymization', async () => {
    const user = userEvent.setup();
    render(<PacientesPage />);
    await user.click(await screen.findByRole('button', { name: 'Acciones para Paciente de prueba' }));
    await user.click(screen.getByRole('menuitem', { name: 'Anonimizar' }));

    const firstDialog = screen.getByRole('dialog', {
      name: 'Confirmar solicitud de anonimización',
    });
    await user.click(within(firstDialog).getByRole('button', { name: 'Continuar' }));

    const finalDialog = await screen.findByRole('dialog', {
      name: 'Confirmación final de seguridad',
    });
    const confirmButton = within(finalDialog).getByRole('button', {
      name: 'Anonimizar expediente',
    });
    expect(confirmButton).toBeDisabled();
    await user.type(within(finalDialog).getByLabelText('Escribe ANONIMIZAR'), 'ANONIMIZAR');
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => {
      expect(
        apiMock.mock.calls.some(
          ([path, options]) =>
            path === '/api/pacientes/12/anonimizar' &&
            options?.method === 'POST' &&
            options?.body?.confirmacion === 'ANONIMIZAR',
        ),
      ).toBe(true);
    });
  }, 10000);
});
