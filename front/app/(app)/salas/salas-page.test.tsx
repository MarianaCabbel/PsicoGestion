// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import SalasPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

const sala = {
  id: 1,
  nombre: 'Sala A',
  estado: 'activa',
  citas_hoy: 0,
  ocupada_ahora: false,
};

const disponibilidad = {
  fecha: '2026-10-19',
  dia_atencion: true,
  num_slots: 24,
  salas: [
    {
      id: 1,
      nombre: 'Sala A',
      ocupados: [],
      horas_ocupadas: [],
      libres: 24,
      estado_dia: 'libre',
    },
  ],
};

function configurarApi(extra?: (path: string, options?: RequestInit) => Promise<unknown> | undefined) {
  apiMock.mockImplementation((path: string, options?: RequestInit) => {
    const custom = extra?.(path, options);
    if (custom) return custom;
    if (String(path).startsWith('/api/salas/disponibilidad?')) {
      return Promise.resolve({ data: disponibilidad });
    }
    if (path === '/api/salas' && options?.method === 'POST') {
      return Promise.resolve({ data: { ...sala, id: 2, nombre: 'Sala B' } });
    }
    if (path === '/api/salas/1' && options?.method === 'PUT') {
      return Promise.resolve({ data: sala });
    }
    if (String(path).startsWith('/api/salas?')) {
      return Promise.resolve({ data: { items: [sala], total: 1, total_paginas: 1 } });
    }
    return Promise.reject(new Error(`Unexpected API request: ${String(path)}`));
  });
}

describe('SalasPage', () => {
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
    configurarApi();
  });

  it('crea una sala y cierra el diálogo', async () => {
    const user = userEvent.setup();
    render(<SalasPage />);
    await screen.findByRole('button', { name: 'Acciones para Sala A' });

    await user.click(screen.getByRole('button', { name: 'Nueva sala' }));
    await user.type(screen.getByLabelText('Nombre de sala'), 'Sala B');
    await user.click(screen.getByRole('button', { name: 'Crear sala' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/api/salas',
        expect.objectContaining({ method: 'POST', body: { nombre: 'Sala B' } }),
      ),
    );
    await waitFor(() => expect(screen.getByLabelText('Nombre de sala')).toHaveValue(''));
  });

  it('edita una sala existente con PUT y conserva el nombre ante un 409', async () => {
    const user = userEvent.setup();
    configurarApi((path, options) => {
      if (path === '/api/salas/1' && options?.method === 'PUT') {
        return Promise.reject(
          new ApiError('Ya existe una sala con ese nombre.', 409, {
            errors: { nombre: 'Ya existe una sala con ese nombre.' },
          }),
        );
      }
      return undefined;
    });
    render(<SalasPage />);
    await screen.findByRole('button', { name: 'Acciones para Sala A' });

    await user.click(screen.getByRole('button', { name: 'Acciones para Sala A' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(screen.getByLabelText('Nombre de sala')).toHaveValue('Sala A');
    await user.clear(screen.getByLabelText('Nombre de sala'));
    await user.type(screen.getByLabelText('Nombre de sala'), 'Sala B');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ya existe una sala con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de sala')).toHaveValue('Sala B');
    expect(apiMock).toHaveBeenCalledWith(
      '/api/salas/1',
      expect.objectContaining({ method: 'PUT', body: { nombre: 'Sala B' } }),
    );
  });

  it('mantiene el valor y muestra un error accionable si falla la red al guardar', async () => {
    const user = userEvent.setup();
    configurarApi((path, options) => {
      if (path === '/api/salas' && options?.method === 'POST') {
        return Promise.reject(
          new ApiError(
            'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
            0,
          ),
        );
      }
      return undefined;
    });
    render(<SalasPage />);
    await screen.findByRole('button', { name: 'Acciones para Sala A' });

    await user.click(screen.getByRole('button', { name: 'Nueva sala' }));
    await user.type(screen.getByLabelText('Nombre de sala'), 'Sala B');
    await user.click(screen.getByRole('button', { name: 'Crear sala' }));

    expect(
      await screen.findByText(/No se pudo conectar con el servidor/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de sala')).toHaveValue('Sala B');
  });

  it('cancelar la baja no llama al API', async () => {
    const user = userEvent.setup();
    render(<SalasPage />);
    await screen.findByRole('button', { name: 'Acciones para Sala A' });

    await user.click(screen.getByRole('button', { name: 'Acciones para Sala A' }));
    await user.click(screen.getByRole('menuitem', { name: 'Dar de baja' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      apiMock.mock.calls.filter(
        ([path, options]) => path === '/api/salas/1' && options?.method === 'DELETE',
      ),
    ).toHaveLength(0);
  });
});
