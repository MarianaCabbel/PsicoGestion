// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { Profiler } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import AgendaPage from './page';

const { apiMock, pushMock } = vi.hoisted(() => ({ apiMock: vi.fn(), pushMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

describe('AgendaPage', () => {
  beforeEach(() => {
    // La agenda parte de la fecha real; se fija la semana de las citas del mock.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
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

    const citas = Array.from({ length: 42 }, (_, index) => {
      const day = 19 + Math.floor(index / 6);
      const hour = 8 + (index % 6);
      return {
        id: index + 1,
        folio: `CIT-2026-${String(index + 1).padStart(6, '0')}`,
        estado: 'pendiente',
        fecha: `2026-10-${String(day).padStart(2, '0')}`,
        hora_inicio: `${String(hour).padStart(2, '0')}:00`,
        hora_fin: `${String(hour).padStart(2, '0')}:30`,
        duracion_slots: 1,
        paciente: { id: index + 1, nombre_completo: `Paciente ${index + 1}` },
        terapeuta: { id: 2, nombre_completo: 'Ana Terapeuta' },
        sala: { id: 3, nombre: 'Sala A' },
      };
    });
    apiMock.mockImplementation((path: string) => {
      if (String(path).startsWith('/api/agenda?')) {
        return Promise.resolve({
          data: {
            vista: 'semana',
            fecha: '2026-10-25',
            desde: '2026-10-19',
            hasta: '2026-10-25',
            citas,
          },
        });
      }
      if (String(path).startsWith('/api/terapeutas?')) {
        return Promise.resolve({ data: { items: [{ id: 2, nombre_completo: 'Ana Terapeuta' }] } });
      }
      if (String(path).startsWith('/api/salas?')) {
        return Promise.resolve({ data: { items: [{ id: 3, nombre: 'Sala A' }] } });
      }
      return Promise.reject(new Error(`Unexpected API request: ${String(path)}`));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 42 appointments within the render budget and exposes keyboard-accessible actions', async () => {
    let slowestRender = 0;
    const started = performance.now();
    const { container } = render(
      <Profiler
        id="agenda"
        onRender={(_id, _phase, actualDuration) => {
          slowestRender = Math.max(slowestRender, actualDuration);
        }}
      >
        <AgendaPage />
      </Profiler>,
    );

    await waitFor(() => expect(container.querySelectorAll('.agenda-appointment')).toHaveLength(42));
    expect(slowestRender).toBeLessThan(500);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(screen.getByRole('button', { name: /Cita CIT-2026-000001/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /2026-10-19 07:00 horario libre/ })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Cita CIT-2026-000001/ }));
    const detailDialog = screen.getByRole('dialog', { name: 'Detalle de cita' });
    expect(detailDialog).toBeVisible();
    expect(within(detailDialog).getByText('Paciente 1')).toBeVisible();
  }, 10000);
});
