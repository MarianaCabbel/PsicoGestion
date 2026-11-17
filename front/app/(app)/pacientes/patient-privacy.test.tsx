// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PacientesPage from './page';

const { apiMock, sessionState } = vi.hoisted(() => ({
  apiMock: vi.fn<(path: string) => Promise<{ data: unknown }>>(),
  sessionState: { user: { id: 1, rol: 'administrador' } },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

describe('Registro de paciente y aviso de privacidad', () => {
  beforeEach(() => {
    apiMock.mockReset();
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
    apiMock.mockResolvedValue({
      data: {
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        total_paginas: 1,
      },
    });
  });

  it('vuelve al mismo formulario abierto conservando los datos capturados', async () => {
    const user = userEvent.setup();
    render(<PacientesPage />);

    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    const patientDialog = screen.getByRole('dialog', { name: 'Nuevo paciente' });
    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Apellido paterno'), 'Pérez');

    await user.click(screen.getByRole('link', { name: /aviso de privacidad/i }));

    const privacyDialog = await screen.findByRole('dialog', {
      name: /aviso de privacidad v1\.0/i,
    });
    expect(privacyDialog).toBeVisible();
    expect(patientDialog).toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Volver al registro de paciente' }));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Nuevo paciente' })).toBeVisible(),
    );
    expect(patientDialog).toHaveAttribute('open');
    expect(screen.getByLabelText('Nombre')).toHaveValue('María');
    expect(screen.getByLabelText('Apellido paterno')).toHaveValue('Pérez');
  });
});
