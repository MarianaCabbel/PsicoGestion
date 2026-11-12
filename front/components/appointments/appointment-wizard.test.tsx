// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    await user.click(await screen.findByRole('button', { name: 'Lucía Solís' }));
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

  it('muestra el estatus actual y pide confirmación antes de modificar la cita', async () => {
    const user = userEvent.setup();
    const editing = {
      id: 99,
      folio: 'CIT-2026-000123',
      estado: 'pendiente',
      fecha: '2026-10-20',
      hora_inicio: '09:00',
      duracion_slots: 1,
      paciente: { id: 11, nombre_completo: 'Lucía Solís' },
      terapeuta: { id: 22, nombre_completo: 'Ana Terapeuta' },
      sala: { id: 33, nombre: 'Sala A' },
    };
    const onSaved = vi.fn();
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
      if (path === '/api/citas/99' && options?.method === 'PUT') {
        return Promise.resolve({ data: editing });
      }
      return Promise.reject(new Error(`Unexpected API request: ${path}`));
    });

    render(
      <AppointmentWizard editing={editing} onOpenChange={vi.fn()} onSaved={onSaved} open />,
    );

    const current = await screen.findByRole('region', { name: 'Datos actuales de la cita' });
    expect(within(current).getByText(/CIT-2026-000123/)).toBeInTheDocument();
    expect(within(current).getByText(/pendiente/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('button', { name: '09:00–09:30' });
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Estatus')).toBeInTheDocument();
    expect(screen.getAllByText(/CIT-2026-000123/).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const firstConfirm = await screen.findByRole('dialog', { name: 'Confirmar modificación' });
    await user.click(within(firstConfirm).getByRole('button', { name: 'Cancelar' }));

    expect(
      apiMock.mock.calls.filter(
        ([path, options]) => path === '/api/citas/99' && options?.method === 'PUT',
      ),
    ).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const secondConfirm = await screen.findByRole('dialog', { name: 'Confirmar modificación' });
    await user.click(
      within(secondConfirm).getByRole('button', { name: 'Confirmar modificación' }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(apiMock).toHaveBeenCalledWith('/api/citas/99', expect.objectContaining({ method: 'PUT' }));
  });

  it('advierte y bloquea el avance cuando la fecha no es día de atención', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/pacientes?')) {
        return Promise.resolve({ data: { items: [{ id: 11, nombre_completo: 'Lucía Solís' }] } });
      }
      if (path.startsWith('/api/terapeutas?')) {
        return Promise.resolve({ data: { items: [{ id: 22, nombre_completo: 'Ana Terapeuta' }] } });
      }
      if (path.startsWith('/api/citas/disponibilidad?')) {
        return Promise.resolve({
          data: { inicios: [], motivo: 'La clínica no atiende ese día de la semana.' },
        });
      }
      return Promise.reject(new Error(`Unexpected API request: ${path}`));
    });

    render(<AppointmentWizard editing={null} onOpenChange={vi.fn()} onSaved={vi.fn()} open />);
    await user.click(await screen.findByRole('button', { name: 'Lucía Solís' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Terapeuta' }), '22');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(
      await screen.findByText(/La clínica no atiende ese día de la semana/),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.queryByRole('combobox', { name: 'Duración' })).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La clínica no atiende ese día de la semana.',
    );
  });
});
