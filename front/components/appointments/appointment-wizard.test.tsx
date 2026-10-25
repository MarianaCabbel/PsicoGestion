// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { AppointmentWizard } from './appointment-wizard';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

describe('AppointmentWizard', () => {
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
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.startsWith('/api/pacientes?')) {
        return Promise.resolve({ data: { items: [{ id: 11, nombre_completo: 'Lucía Solís' }] } });
      }
      if (path.startsWith('/api/terapeutas?')) {
        return Promise.resolve({ data: { items: [{ id: 22, nombre_completo: 'Ana Terapeuta' }] } });
      }
      if (path.startsWith('/api/citas/disponibilidad?')) {
        return Promise.resolve({
          data: {
            inicios: [
              {
                hora_inicio: '09:00',
                hora_fin: '09:30',
                salas_libres: [{ id: 33, nombre: 'Sala A' }],
              },
            ],
          },
        });
      }
      if (path === '/api/citas' && options?.method === 'POST') {
        return Promise.reject(new Error('mock not configured'));
      }
      return Promise.reject(new Error(`Unexpected API request: ${path}`));
    });
  });

  it('keeps all chosen values after a 409 and refreshes available slots', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.startsWith('/api/pacientes?')) {
        return Promise.resolve({ data: { items: [{ id: 11, nombre_completo: 'Lucía Solís' }] } });
      }
      if (path.startsWith('/api/terapeutas?')) {
        return Promise.resolve({ data: { items: [{ id: 22, nombre_completo: 'Ana Terapeuta' }] } });
      }
      if (path.startsWith('/api/citas/disponibilidad?')) {
        return Promise.resolve({
          data: {
            inicios: [
              {
                hora_inicio: '09:00',
                hora_fin: '09:30',
                salas_libres: [{ id: 33, nombre: 'Sala A' }],
              },
            ],
          },
        });
      }
      if (path === '/api/citas' && options?.method === 'POST') {
        return Promise.reject(new ApiError('Ese horario acaba de ocuparse.', 409));
      }
      return Promise.reject(new Error(`Unexpected API request: ${path}`));
    });

    render(<AppointmentWizard editing={null} onOpenChange={vi.fn()} onSaved={vi.fn()} open />);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Paciente' }), '11');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Terapeuta' }), '22');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Duración' }), '1');
    await user.click(await screen.findByRole('button', { name: '09:00–09:30' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cita' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario acaba de ocuparse.');
    expect(screen.getByText('Lucía Solís')).toBeInTheDocument();
    expect(screen.getByText('Ana Terapeuta')).toBeInTheDocument();
    expect(screen.getByText('09:00 (30 min)')).toBeInTheDocument();
    expect(screen.getByText('Sala A')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        apiMock.mock.calls.filter(([path]) => String(path).startsWith('/api/citas/disponibilidad?'))
          .length,
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
