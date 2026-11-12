// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CitasPage from './page';

const { apiMock, postMessageMock, searchParamsMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  postMessageMock: vi.fn(),
  searchParamsMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({ useSearchParams: () => searchParamsMock() }));

const cita = {
  id: 7,
  folio: 'CIT-2026-000123',
  estado: 'pendiente',
  fecha: '2026-10-20',
  hora_inicio: '09:00',
  hora_fin: '09:30',
  duracion_slots: 1,
  paciente: { id: 1, nombre_completo: 'Lucía Solís', telefono: '9991112233' },
  terapeuta: { id: 2, nombre_completo: 'Ana Terapeuta' },
  sala: { id: 3, nombre: 'Sala A' },
  paciente_tiene_correo: true,
  notificacion: null,
};

class FakeBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(readonly name: string) {}

  postMessage(message: unknown) {
    postMessageMock(message);
  }

  close() {}
}

describe('CitasPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    postMessageMock.mockReset();
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams());
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
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

    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (String(path).startsWith('/api/salas?')) {
        return Promise.resolve({ data: { items: [{ id: 3, nombre: 'Sala A' }] } });
      }
      if (String(path).startsWith('/api/terapeutas?')) {
        return Promise.resolve({ data: { items: [{ id: 2, nombre_completo: 'Ana Terapeuta' }] } });
      }
      if (String(path) === '/api/citas/folio/CIT-2026-000123') {
        return Promise.resolve({ data: cita });
      }
      if (String(path).startsWith('/api/citas?')) {
        return Promise.resolve({ data: { items: [cita], page: 1, total: 1, total_paginas: 1 } });
      }
      if (String(path) === '/api/citas/7/cancelar' && options?.method === 'POST') {
        return Promise.resolve({ data: { ...cita, estado: 'cancelada' } });
      }
      return Promise.reject(new Error(`Unexpected API request: ${String(path)}`));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carga directamente una cita desde el enlace ?folio=', async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('folio=CIT-2026-000123'));
    render(<CitasPage />);

    expect(await screen.findByText('Detalle de cita')).toBeInTheDocument();
    expect(screen.getAllByText('Lucía Solís').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CIT-2026-000123').length).toBeGreaterThan(0);
    expect(
      apiMock.mock.calls.filter(([path]) => String(path).startsWith('/api/citas?')),
    ).toHaveLength(0);
  });

  it('al cancelar avisa a las demás vistas para refrescar la agenda', async () => {
    const user = userEvent.setup();
    render(<CitasPage />);

    await user.click(await screen.findByRole('button', { name: 'Acciones para CIT-2026-000123' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar cita' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/citas/7/cancelar',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'citas-actualizadas' }),
    );
  });
});
